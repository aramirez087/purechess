import "./observability/sentry";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import cookieParser from "cookie-parser";
import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";
import { initSentry } from "./observability/sentry";
import { AllExceptionsFilter } from "./observability/all-exceptions.filter";
import { PosthogService } from "./analytics/posthog.service";
import { AppModule } from "./app.module";

initSentry();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  app.use(
    (req: Request & { id?: string }, _res: Response, next: NextFunction) => {
      if (!req.headers["x-request-id"]) {
        req.headers["x-request-id"] = randomUUID();
      }
      next();
    },
  );

  app.use(cookieParser());
  app.setGlobalPrefix("api");

  app.enableCors({
    origin: [
      "http://localhost:3000",
      "https://purechess-web.fly.dev",
      process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000",
      process.env["WEB_URL"] ?? "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter(app.get(PosthogService)));

  const port = process.env["PORT"] ?? 4000;
  await app.listen(port);
}

bootstrap();
