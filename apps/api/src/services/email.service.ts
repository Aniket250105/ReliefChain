export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
}

export interface IEmailProvider {
  sendEmail(payload: EmailPayload): Promise<boolean>;
}

export class MockEmailProvider implements IEmailProvider {
  async sendEmail(payload: EmailPayload): Promise<boolean> {
    console.log(`[MockEmailProvider] Sending email to: ${payload.to}`);
    console.log(`[MockEmailProvider] Subject: ${payload.subject}`);
    console.log(`[MockEmailProvider] Body: ${payload.body}`);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));
    return true; // Return success
  }
}

export class EmailService {
  private provider: IEmailProvider;

  constructor(provider?: IEmailProvider) {
    this.provider = provider || new MockEmailProvider();
  }

  async send(payload: EmailPayload): Promise<boolean> {
    try {
      return await this.provider.sendEmail(payload);
    } catch (e: any) {
      console.error(`Email delivery failed: ${e.message}`);
      return false; // Safely fail
    }
  }
}

export const emailService = new EmailService();
