import { NestFactory } from '@nestjs/core';
import { PulseBridgeBatchModule } from './batch.module';

async function bootstrap() {
  const app = await NestFactory.create(PulseBridgeBatchModule);
  await app.listen(process.env.PORT_BATCH ?? 3000);
}
bootstrap();
