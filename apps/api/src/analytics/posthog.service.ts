import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PostHog } from "posthog-node";

@Injectable()
export class PosthogService implements OnModuleDestroy {
  private client: PostHog | null = null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("POSTHOG_API_KEY");
    if (!apiKey) return;

    this.client = new PostHog(apiKey, {
      host:
        this.config.get<string>("POSTHOG_HOST") ?? "https://us.i.posthog.com",
      flushAt: 20,
      flushInterval: 10000,
      enableExceptionAutocapture: true,
    });
  }

  captureEvent(
    distinctId: string,
    event: string,
    properties?: Record<string, unknown>,
  ): void {
    if (!this.client) return;
    this.client.capture({ distinctId, event, properties: properties ?? {} });
  }

  identify(distinctId: string, properties?: Record<string, unknown>): void {
    if (!this.client) return;
    this.client.identify({ distinctId, properties });
  }

  captureException(error: unknown, distinctId?: string): void {
    if (!this.client) return;
    this.client.captureException(error, distinctId);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.shutdown();
    }
  }
}
