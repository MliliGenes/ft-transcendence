import { Injectable } from '@nestjs/common';

// Edit these two values to update the small email-style page at /api/.
const subject = 'hello my friend';
const message = 'If you read this, that means i am probably dead, or gone insane, or both. i did not ask for anything more than a cool team, people who can communicate, and a chance to do something meaningful. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this. i did not ask for this.';
const htmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => htmlEntities[character]);

@Injectable()
export class AppService {
  getHello(): string {
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeSubject}</title>
  </head>
  <body>
    <main>
      <p><strong>Subject:</strong> ${safeSubject}</p>
      <p>${safeMessage}</p>
    </main>
  </body>
</html>`;
  }
}
