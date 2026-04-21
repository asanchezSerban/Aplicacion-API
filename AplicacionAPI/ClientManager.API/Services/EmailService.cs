using MailKit.Net.Smtp;
using MimeKit;

namespace ClientManager.API.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration config, ILogger<EmailService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendAsync(string toEmail, string toName, string subject, string htmlBody)
    {
        var host = _config["Email:Host"] ?? "localhost";
        var port = int.Parse(_config["Email:Port"] ?? "2525");
        var fromAddress = _config["Email:FromAddress"] ?? "noreply@clientmanager.local";
        var fromName = _config["Email:FromName"] ?? "ClientManager";

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromAddress));
        message.To.Add(new MailboxAddress(toName, toEmail));
        message.Subject = subject;
        message.Body = new TextPart("html") { Text = htmlBody };

        using var client = new SmtpClient();
        await client.ConnectAsync(host, port, MailKit.Security.SecureSocketOptions.None);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);

        _logger.LogInformation("Email enviado a {Email}: {Subject}", toEmail, subject);
    }
}
