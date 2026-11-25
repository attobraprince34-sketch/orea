"""Envoi des e-mails (SMTP ; Mailpit en local : http://localhost:8025).

Chaque e-mail a une version HTML aux couleurs d'Orea et une version texte brut
(lecteurs d'écran, messageries qui bloquent le HTML).

Les envois sont faits en tâche de fond APRÈS la validation de la transaction
(voir notification_service.dispatch_emails) : une panne du serveur d'e-mail ne
fait jamais échouer une déclaration, elle est seulement journalisée.
"""

import logging
import re
import smtplib
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from pathlib import Path
from typing import TYPE_CHECKING

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.config import settings

if TYPE_CHECKING:
    from app.models import User
    from app.services.notification_service import PendingEmail

logger = logging.getLogger("orea.email")

_TEMPLATES = Environment(
    loader=FileSystemLoader(Path(__file__).resolve().parent.parent / "templates" / "emails"),
    autoescape=select_autoescape(["html"]),
)


def absolute_url(link: str | None) -> str | None:
    if not link:
        return None
    if link.startswith(("http://", "https://")):
        return link
    return settings.FRONTEND_URL.rstrip("/") + "/" + link.lstrip("/")


def _cta_for(link: str | None) -> tuple[str, str]:
    """Libellé du bouton et sur-titre adaptés à la notification."""
    if link and link.startswith("/reclamer/"):
        return "Récupérer ma pièce", "Pièce retrouvée"
    if link and "qr" in link:
        return "Afficher mon QR code", "Retrait"
    return "Ouvrir Orea", "Orea"


def build_message(*, to: str, name: str, subject: str, body: str,
                  link: str | None = None, eyebrow: str | None = None,
                  cta: str | None = None) -> EmailMessage:
    url = absolute_url(link)
    default_cta, default_eyebrow = _cta_for(link)
    context = {
        "subject": subject,
        "name": name,
        "body": body,
        "url": url,
        "cta": cta or default_cta,
        "eyebrow": eyebrow or default_eyebrow,
        "preheader": body[:110],
    }
    html = _TEMPLATES.get_template("notification.html").render(**context)
    text = f"Bonjour {name},\n\n{body}\n"
    if url:
        text += f"\n{context['cta']} : {url}\n"
    text += "\n— L'équipe Orea\nOrea ne te demandera jamais le numéro de ta pièce par e-mail.\n"

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM
    message["To"] = formataddr((name, to))
    message["Message-ID"] = make_msgid(domain="orea.ci")
    message.set_content(text)
    message.add_alternative(html, subtype="html")
    return message


def send(message: EmailMessage) -> bool:
    """Envoie un e-mail. Ne lève jamais d'exception : renvoie False en cas d'échec."""
    if not settings.EMAIL_ENABLED:
        logger.info("E-mail désactivé, non envoyé : %s", message["Subject"])
        return False
    if settings.EMAIL_BACKEND == "file":
        return _save_to_outbox(message)
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT,
                          timeout=settings.SMTP_TIMEOUT_SECONDS) as smtp:
            if settings.SMTP_STARTTLS:
                smtp.starttls()
            if settings.SMTP_USER:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
            smtp.send_message(message)
        logger.info("E-mail envoyé à %s : %s", message["To"], message["Subject"])
        return True
    except (smtplib.SMTPException, OSError) as exc:
        logger.warning("Échec de l'envoi de l'e-mail « %s » : %s", message["Subject"], exc)
        return False


def _save_to_outbox(message: EmailMessage) -> bool:
    """Mode local sans serveur d'e-mail : chaque message devient un fichier HTML
    (à ouvrir dans le navigateur) dans OUTBOX_DIR."""
    try:
        outbox = Path(settings.OUTBOX_DIR)
        outbox.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        recipient = re.sub(r"[^a-z0-9]+", "-", str(message["To"]).lower()).strip("-")[:40]
        html_part = message.get_body(preferencelist=("html",))
        html = html_part.get_content() if html_part else str(message)
        (outbox / f"{stamp}_{recipient}.html").write_text(html, encoding="utf-8")
        logger.info("E-mail enregistré dans %s : %s", outbox, message["Subject"])
        return True
    except OSError as exc:
        logger.warning("Impossible d'enregistrer l'e-mail « %s » : %s", message["Subject"], exc)
        return False


def send_notification_email(pending: "PendingEmail") -> bool:
    return send(build_message(to=pending.to, name=pending.name, subject=pending.subject,
                              body=pending.body, link=pending.link))


def send_welcome_email(user: "User") -> bool:
    return send(build_message(
        to=user.email,
        name=user.full_name,
        subject="Bienvenue sur Orea !",
        eyebrow="Bienvenue",
        body=(
            "Ton compte est prêt. Tu as perdu une pièce ? Déclare-la : on te prévient dès "
            "qu'elle refait surface, même si ton nom est mal orthographié. Tu en as trouvé "
            "une ? Prends-la en photo, Orea s'occupe du reste."
        ),
        link="/tableau-de-bord",
        cta="Accéder à mon espace",
    ))
