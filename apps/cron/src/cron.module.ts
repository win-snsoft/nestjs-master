import { Module } from '@nestjs/common';
import { CronService } from './cron.service.js';
import { ScheduleModule } from '@nestjs/schedule';
import { ApplicationModule } from '@application';
@Module({
  imports: [ApplicationModule, ScheduleModule.forRoot()],
  providers: [CronService],
})
export class CronModule {}
