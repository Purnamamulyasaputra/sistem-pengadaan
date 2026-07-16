import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { to, subject, message, pdfBase64, poNumber } = body;

    if (!to || !pdfBase64) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    // Configure nodemailer with environment variables
    const transporter = nodemailer.createTransport({
      service: 'gmail', // or use host/port directly
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    // Check if env vars are set
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      return NextResponse.json({ 
        success: false, 
        message: 'Sistem email belum dikonfigurasi. Silakan hubungi administrator untuk memasukkan EMAIL_USER dan EMAIL_APP_PASSWORD di environment variables.' 
      }, { status: 500 });
    }

    const mailOptions = {
      from: `"Sunrise Daily Purchasing" <${process.env.EMAIL_USER}>`,
      to,
      subject: subject || `Purchase Order ${poNumber} - Sunrise Daily`,
      text: message || `Dear Vendor,\n\nPlease find attached our Purchase Order ${poNumber}.\n\nThank you,\nSunrise Daily Purchasing`,
      attachments: [
        {
          filename: `${poNumber || 'PO'}.pdf`,
          content: pdfBase64.split('base64,')[1] || pdfBase64,
          encoding: 'base64',
          contentType: 'application/pdf'
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);

    return NextResponse.json({ success: true, message: 'Email berhasil dikirim ke ' + to });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengirim email: ' + error.message }, { status: 500 });
  }
}
