import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    HttpModule,
    // async: SECRET_TOKEN is read after ConfigModule.forRoot() has loaded .env
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('SECRET_TOKEN'),
        signOptions: { expiresIn: '30d' },
      }),
    })
  ],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule { }
