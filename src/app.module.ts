import { Module } from '@nestjs/common';
import { ActivityLogsModule } from '@/modules/activity-logs/activity-logs.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { UsersModule } from '@/modules/users/users.module';
import { SharedModule } from '@/shared/shared.module';

@Module({
  imports: [SharedModule, UsersModule, ActivityLogsModule, AuthModule],
})
export class AppModule {}
