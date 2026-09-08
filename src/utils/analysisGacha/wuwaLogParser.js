const iconv = require('iconv-lite');

// Newer Client.log files encode selected sections with a byte-wise XOR table.
// The key is selected from the stored byte, so this is intentionally a lookup
// table rather than a single XOR operation.
const DECODE_TABLE = Buffer.from(
    Array.from({ length: 256 }, (_, value) =>
        value ^ (value % 2 === 1 ? 0xA5 : 0xEF)
    )
);

const GACHA_URL_REGEX = /https?:\/\/aki-gm-resources(?:-oversea|\.oversea)?\.aki-game(?:2)?\.(?:com|net)\/aki\/gacha\/index\.html#\/record\?[^\s"'\\<>\[\]]+/gi;

function decodeXorLogBytes(raw) {
    const decoded = Buffer.allocUnsafe(raw.length);
    for (let index = 0; index < raw.length; index += 1) {
        decoded[index] = DECODE_TABLE[raw[index]];
    }
    return decoded;
}

function normalizeEscapedText(text) {
    return text
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, codePoint) =>
            String.fromCharCode(parseInt(codePoint, 16))
        )
        .replace(/\\\//g, '/');
}

function extractGachaUrls(text) {
    const normalized = normalizeEscapedText(text);
    const matches = normalized.match(GACHA_URL_REGEX) || [];

    return matches.map((url) => url.replace(/[),.;\]}>'"]+$/g, ''));
}

function decodedTextViews(raw) {
    const views = [raw, decodeXorLogBytes(raw)];
    if (raw.length > 3) {
        views.push(decodeXorLogBytes(raw.subarray(3)));
    }

    return views.flatMap((view) => {
        const texts = [view.toString('utf8')];
        const legacyText = iconv.decode(view, 'gb18030');
        if (legacyText !== texts[0]) texts.push(legacyText);
        return texts;
    });
}

function extractGachaUrlsFromBuffer(raw) {
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    const urls = [];
    const seen = new Set();

    for (const text of decodedTextViews(buffer)) {
        for (const url of extractGachaUrls(text)) {
            if (!seen.has(url)) {
                seen.add(url);
                urls.push(url);
            }
        }
    }

    return urls;
}

function findLatestGachaUrl(raw) {
    const urls = extractGachaUrlsFromBuffer(raw);
    return urls.length > 0 ? urls[urls.length - 1] : null;
}

module.exports = {
    DECODE_TABLE,
    decodeXorLogBytes,
    extractGachaUrls,
    extractGachaUrlsFromBuffer,
    findLatestGachaUrl,
};
