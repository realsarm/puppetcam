const puppeteer = require('puppeteer');
const Xvfb = require('xvfb');
const fs = require('fs').promises;
var width = 1280;
var height = 720;
var xvfb = new Xvfb({silent: true, xvfb_args: ["-screen", "0", `${ width }x${ height }x24`, "-ac"],});
var options = {
    headless: false,
    args: [
        '--enable-usermedia-screen-capturing',
        '--allow-http-screen-capture',
        '--auto-select-desktop-capture-source=puppetcam',
        '--load-extension=' + __dirname,
        '--disable-extensions-except=' + __dirname,
        '--disable-infobars',
        `--window-size=${ width },${ height }`,
    ],
}

function extractCookies(text) {

    var cookies = [];
    var lines = text.split("\n");

    // iterate over lines
    lines.forEach(function (line, index) {

        var tokens = line.split("\t");

        // we only care for valid cookie def lines
        if (tokens.length == 7) {

            // trim the tokens
            tokens = tokens.map(function (e) {
                return e.trim();
            });

            var cookie = {};

            // Extract the data
            cookie.domain = tokens[0];
            cookie.flag = tokens[1] === 'TRUE';
            cookie.path = tokens[2];
            cookie.secure = tokens[3] === 'TRUE';

            // Convert date to a readable format

            var timestamp = tokens[4];
            if (timestamp.length == 17) {
                timestamp = Math.floor(timestamp / 1000000 - 11644473600);
            }

            cookie.expiration = timestamp;

            cookie.name = tokens[5];
            cookie.value = tokens[6];

            // Record the cookie.
            cookies.push(cookie);
        }
    });

    return cookies;
}

async function main() {
    xvfb.startSync()
    var url = process.argv[2], exportname = process.argv[3], cookies = process.argv[4]
    if (!url) {
        url = 'http://tobiasahlin.com/spinkit/'
    }
    if (!exportname) {
        exportname = 'spinner.webm'
    }
    const browser = await puppeteer.launch(options)
    const pages = await browser.pages()
    const page = pages[0]
    if (cookies) {
        const cookiesString = await fs.readFile(cookies);
        const cookiesJSONString = extractCookies(cookiesString.toString())
        console.log(cookiesString)
        await page.setCookie(...cookiesJSONString);
    }
    await page._client.send('Emulation.clearDeviceMetricsOverride');
    await page.goto(url, {waitUntil: 'networkidle2'})
    await page.setBypassCSP(true)

    // Perform any actions that have to be captured in the exported video
    await page.waitFor(8000)

    await page.evaluate(filename => {
        window.postMessage({type: 'SET_EXPORT_PATH', filename: filename}, '*')
        window.postMessage({type: 'REC_STOP'}, '*')
    }, exportname)

    // Wait for download of webm to complete
    await page.waitForSelector('html.downloadComplete', {timeout: 0})
    await browser.close()
    xvfb.stopSync()
}

main()

