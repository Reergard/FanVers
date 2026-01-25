"""
Кастомный email backend для логирования всех отправленных писем
"""
import logging
from django.core.mail.backends.smtp import EmailBackend as SMTPEmailBackend
from django.core.mail.message import EmailMessage
import time

logger = logging.getLogger(__name__)


class LoggingEmailBackend(SMTPEmailBackend):
    """
    Email backend с детальным логированием всех отправленных писем
    Наследуется от стандартного SMTP backend и добавляет логирование
    """
    
    def send_messages(self, email_messages):
        """
        Отправляет сообщения и логирует каждое
        """
        if not email_messages:
            return 0
        
        logger.info(f"📧 [EmailBackend] === START SENDING EMAILS ===")
        logger.info(f"📧 [EmailBackend] Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"📧 [EmailBackend] Messages count: {len(email_messages)}")
        
        sent_count = 0
        failed_count = 0
        
        for i, message in enumerate(email_messages):
            try:
                logger.info(f"📧 [EmailBackend] === EMAIL #{i+1}/{len(email_messages)} ===")
                logger.info(f"📧 [EmailBackend] From: {message.from_email}")
                logger.info(f"📧 [EmailBackend] To: {message.to}")
                logger.info(f"📧 [EmailBackend] Cc: {message.cc if message.cc else 'None'}")
                logger.info(f"📧 [EmailBackend] Bcc: {message.bcc if message.bcc else 'None'}")
                logger.info(f"📧 [EmailBackend] Subject: {message.subject}")
                logger.info(f"📧 [EmailBackend] Body length: {len(message.body) if message.body else 0} chars")
                logger.info(f"📧 [EmailBackend] Content type: {message.content_subtype}")
                logger.info(f"📧 [EmailBackend] Attachments count: {len(message.attachments) if hasattr(message, 'attachments') else 0}")
                
                # Пытаемся определить тип письма по subject
                subject_lower = message.subject.lower() if message.subject else ''
                if 'activation' in subject_lower or 'активация' in subject_lower:
                    logger.info(f"📧 [EmailBackend] Email type: ACTIVATION EMAIL")
                elif 'confirmation' in subject_lower or 'подтверждение' in subject_lower:
                    logger.info(f"📧 [EmailBackend] Email type: CONFIRMATION EMAIL")
                elif 'password' in subject_lower or 'пароль' in subject_lower:
                    logger.info(f"📧 [EmailBackend] Email type: PASSWORD RESET EMAIL")
                elif 'username' in subject_lower or 'логин' in subject_lower:
                    logger.info(f"📧 [EmailBackend] Email type: USERNAME CHANGE EMAIL")
                else:
                    logger.info(f"📧 [EmailBackend] Email type: OTHER")
                
                logger.info(f"📧 [EmailBackend] Attempting to send email...")
                
                # Вызываем родительский метод для реальной отправки
                result = super().send_messages([message])
                
                if result > 0:
                    sent_count += result
                    logger.info(f"📧 [EmailBackend] ✅ EMAIL SENT SUCCESSFULLY")
                    logger.info(f"📧 [EmailBackend] Recipient: {', '.join(message.to)}")
                else:
                    failed_count += 1
                    logger.error(f"📧 [EmailBackend] ❌ EMAIL SEND FAILED")
                    logger.error(f"📧 [EmailBackend] Recipient: {', '.join(message.to)}")
                    
            except Exception as e:
                failed_count += 1
                logger.error(f"📧 [EmailBackend] ❌ EMAIL SEND ERROR")
                logger.error(f"📧 [EmailBackend] Recipient: {', '.join(message.to) if message.to else 'N/A'}")
                logger.error(f"📧 [EmailBackend] Error: {str(e)}", exc_info=True)
        
        logger.info(f"📧 [EmailBackend] === SENDING COMPLETE ===")
        logger.info(f"📧 [EmailBackend] Total sent: {sent_count}")
        logger.info(f"📧 [EmailBackend] Total failed: {failed_count}")
        
        return sent_count

