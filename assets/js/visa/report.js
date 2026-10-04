// "Report a problem", shared by the Visa map and Visa docs pages. The reader describes the
// problem; the page sends it to /api/report (worker/index.js), whose Telegram bot passes it
// to the admin with a bug-report picture and a text snapshot. Without a picture the text
// still goes; if sending fails, a Telegram link with the same text is offered instead.
import { C, MONO, font, roundRect, renderPicture, saveBlob, wrap, wrapAnywhere } from './shared.js';

// snapshot() describes what the page shows right now:
//   page      'Visa map' or 'Visa docs' (English, for the admin)
//   link      address that reopens the same view
//   summary   lines for the Telegram fallback message, in the page language
//   text(message, sender)  the full text snapshot for the admin or an AI assistant
//   sections  [{ heading, rows }] for the picture; a row is a string, { text, muted },
//             or { num, strong, rest, green } for a numbered line
//   fileTag   part of the picture's file name
export function setupReport(ctx, snapshot) {
    const { T, lang } = ctx;
    const report = document.getElementById('vm-report');
    if (!report) return;
    const reportForm = document.getElementById('vm-report-form');
    const status = document.getElementById('vm-report-status');
    const sendButton = document.getElementById('vm-report-send');
    const telegram = document.getElementById('vm-report-telegram');
    const download = document.getElementById('vm-report-download');
    const say = (message) => {
        status.textContent = message;
    };
    // Optional, so the admin knows who wrote and can answer.
    const sender = () => ({ name: reportForm.elements.name.value.trim(), contact: reportForm.elements.contact.value.trim() });
    const picture = (view, message) => renderPicture((c, draw) => paintReport(c, draw, ctx, view, message, sender()));

    ctx.root.querySelectorAll('[data-report]').forEach((button) => button.addEventListener('click', () => {
        say('');
        sendButton.hidden = false;
        sendButton.disabled = false;
        telegram.hidden = true;
        download.hidden = true;
        reportForm.elements.message.readOnly = false;
        report.showModal();
        reportForm.elements.message.focus();
    }));

    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = reportForm.elements.message.value.trim();
        if (!message) {
            say(T.reportEmpty);
            reportForm.elements.message.focus();
            return;
        }
        sendButton.disabled = true;
        say(T.reportSending);
        const view = snapshot();
        const from = sender();
        const body = new FormData();
        body.append('message', message);
        body.append('name', from.name);
        body.append('contact', from.contact);
        body.append('details', view.text(message, from));
        body.append('link', view.link);
        body.append('lang', lang);
        const image = await picture(view, message).catch(() => null);
        if (image) body.append('picture', image, 'bug-report.png');
        let response = null;
        try {
            response = await fetch('/api/report', { method: 'POST', body });
        } catch {
            // Offline or blocked: offer Telegram below.
        }
        if (response && response.ok) {
            say(T.reportSent);
            sendButton.hidden = true;
            reportForm.elements.message.readOnly = true;
            return;
        }
        sendButton.disabled = false;
        if (response && response.status === 429) {
            say(T.reportBusy);
            return;
        }
        say(T.reportFailed);
        const text = [T.reportMsg, ...view.summary, `${T.reportMap}: ${view.link}`, '', T.reportProblem, message].join('\n');
        telegram.href = `https://t.me/${T.telegramAdmin}?text=${encodeURIComponent(text)}`;
        telegram.hidden = false;
        download.hidden = !image;
    });

    download.addEventListener('click', async () => {
        const view = snapshot();
        saveBlob(await picture(view, reportForm.elements.message.value.trim()), `bug-report-${view.fileTag}.png`);
    });
    telegram.addEventListener('click', () => report.close());
    document.getElementById('vm-report-close').addEventListener('click', () => report.close());
    // A click on the dimmed area around the dialog closes it.
    report.addEventListener('click', (e) => {
        const box = report.getBoundingClientRect();
        if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) report.close();
    });
}

// A picture for the admin, not a plan for the reader: a red BUG REPORT band, the reader's
// message, the page's sections and the link that reopens the same view.
const R = { red: '#b42318', redSoft: '#fef3f2', redLine: '#fecdca' };

function paintReport(ctx, draw, page, view, message, sender) {
    const W = 1080;
    const P = 56;
    const inner = W - 2 * P;
    const stamp = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;
    ctx.textBaseline = 'alphabetic';
    const text = (value, x, y, style, color) => {
        ctx.font = style;
        if (draw) {
            ctx.fillStyle = color;
            ctx.fillText(value, x, y);
        }
    };

    // Red band with a warning mark.
    const bandH = 150;
    if (draw) {
        ctx.fillStyle = R.red;
        ctx.fillRect(0, 0, W, bandH);
        ctx.beginPath();
        ctx.arc(P + 42, bandH / 2, 42, 0, Math.PI * 2);
        ctx.fillStyle = C.white;
        ctx.fill();
    }
    ctx.textAlign = 'center';
    text('!', P + 42, bandH / 2 + 21, font(800, 60), R.red);
    ctx.textAlign = 'left';
    text('BUG REPORT', P + 112, 76, font(800, 48), C.white);
    text(`${page.T.site} · ${view.page} · ${page.lang} · ${stamp}`, P + 112, 114, font(500, 24), 'rgba(255,255,255,0.88)');

    let y = bandH;
    const heading = (title) => {
        y += 52;
        text(title.toUpperCase(), P, y, font(800, 22), R.red);
        y += 8;
    };
    const paragraph = (value, size, color, maxLines, family) => {
        const style = font(400, size, family);
        ctx.font = style;
        const lines = family ? wrapAnywhere(ctx, value, inner) : wrap(ctx, value, inner, maxLines);
        lines.forEach((line) => {
            y += Math.round(size * 1.45);
            text(line, P, y, style, color);
        });
    };

    // The reader's message, in a tinted box.
    heading('Message from the user');
    ctx.font = font(500, 28);
    const said = wrap(ctx, message, inner - 48, 14);
    const from = [sender.name, sender.contact].filter(Boolean).join(' · ');
    const boxTop = y + 14;
    const boxH = said.length * 40 + 36 + (from ? 44 : 0);
    if (draw) {
        roundRect(ctx, P, boxTop, inner, boxH, 18);
        ctx.fillStyle = R.redSoft;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = R.redLine;
        ctx.stroke();
    }
    said.forEach((line, i) => text(line, P + 24, boxTop + 46 + i * 40, font(500, 28), C.ink));
    if (from) text(`From: ${from}`, P + 24, boxTop + boxH - 22, font(600, 24), C.muted);
    y = boxTop + boxH;

    view.sections.forEach((section) => {
        heading(section.heading);
        // Numbered rows: room for the widest number, then one line each, cut to fit.
        ctx.font = font(700, 26);
        const numbers = section.rows.filter((row) => row.num !== undefined).map((row) => ctx.measureText(`${row.num}.`).width);
        const textX = P + Math.max(48, Math.max(0, ...numbers) + 14);
        section.rows.forEach((row) => {
            if (typeof row === 'string') paragraph(row, 26, C.ink, 8);
            else if (row.num !== undefined) {
                y += 42;
                text(`${row.num}.`, P, y, font(700, 26), C.muted);
                ctx.font = font(800, 28);
                const strong = wrap(ctx, row.strong, W - P - textX - 30, 1)[0] || '';
                text(strong, textX, y, font(800, 28), row.green ? C.green : C.ink);
                ctx.font = font(800, 28);
                const restX = textX + ctx.measureText(strong).width + 16;
                ctx.font = font(400, 26);
                const room = W - P - restX;
                const rest = strong === row.strong ? wrap(ctx, row.rest || '', room - 30, 1)[0] || '' : '';
                if (rest && ctx.measureText(rest).width <= room) text(rest, restX, y, font(400, 26), C.muted);
            } else {
                paragraph(row.text, 26, row.muted ? C.muted : C.ink, 8);
            }
        });
    });

    heading('Link');
    paragraph(view.link, 20, C.muted, 0, MONO);

    y += 40;
    if (draw) {
        ctx.fillStyle = C.line;
        ctx.fillRect(P, y, inner, 2);
    }
    y += 40;
    text(`Reported from ${page.T.url}. The text snapshot sent with this picture has every detail.`, P, y, font(400, 22), C.muted);
    return y + P;
}
