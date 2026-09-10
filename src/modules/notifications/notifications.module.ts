import { Module } from '@nestjs/common';
import { TicketNotificationService } from './ticket-notification.service';

@Module({
  providers: [TicketNotificationService],
  exports: [TicketNotificationService],
})
export class NotificationsModule {}
