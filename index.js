const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker");

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

(async () => {
  const browser = await puppeteer.launch({
    // headless: false,
    slowMo: 100,
    ignoreHTTPSErrors: true,
    args: [
      "--window-size=1400,900",
      "--remote-debugging-port=9222",
      "--remote-debugging-address=0.0.0.0", // You know what your doing?
      "--disable-gpu",
      "--disable-features=IsolateOrigins,site-per-process",
      "--blink-settings=imagesEnabled=true",
    ],
  });
  const page = await browser.newPage();

  // tweak the URL here based on whatever URL you get after searching location
  await page.goto(
    "https://www.rentalcars.com/search-results?location=35306&dropLocation=35306&locationName=Dubai%20Airport&dropLocationName=Dubai%20Airport&coordinates=25.252500534057617%2C55.36429977416992&dropCoordinates=25.252500534057617%2C55.36429977416992&driversAge=30&puDay=18&puMonth=11&puYear=2021&puMinute=0&puHour=10&doDay=21&doMonth=11&doYear=2021&doMinute=0&doHour=10&ftsType=A&dropFtsType=A",
    { waitUntil: "networkidle0" }
  );

  console.log("page loaded, timing out for half a second...");

  // first wait for half a second, to avoid race conditions
  await page.waitForTimeout(500);

  // just a logger
  page.on("console", (clg) => console.log(clg.text()));

  // wait for recaptcha checkbox to show up. If not, then continue after about 5 seconds (throws if not found after timeout)
  try {
    console.log("checking for recaptcha checkbox...");

    await page.waitForSelector(".recaptcha-checkbox-checkmark", {
      timeout: 5000,
    });

    await page.evaluate(() => {
      // click on the checkbox after finding it
      document.querySelector(".recaptcha-checkbox-checkmark")?.click();
      console.log("recaptcha checkbox found and bypassed");
    });
  } catch (error) {
    console.log("no recaptcha checkbox found");
  }

  // extract the data in the page
  const data = await page.evaluate(async () => {
    const CarTypes = ["small", "medium", "large", "premium", "SUV"];

    // final array of objects to return
    const finalData = [];

    // check every 1 second if still loading
    const loaderXpath =
      "//h1[text()='Checking the top companies to find the best deals']";
    while (
      document.evaluate(
        loaderXpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue
    ) {
      console.log("still in loading page...");
      await new Promise((resolve) => setTimeout(resolve, 1000)); // check every 1 second if loading is done
    }

    console.log("done loading");

    // get all the sections which represent each result in the search
    const AllResults = document.querySelectorAll(
      "section[aria-label~='SEARCH']"
    );

    // iterate through each section and access relevant child elements
    for (const node of AllResults) {
      // name and size
      const carName = node.querySelector("h3")?.innerText;
      const carSize = node
        .querySelector("span[data-testid~='make-and-model-or-similar-text']")
        ?.innerHTML.split(" ")
        .find((reqString) => CarTypes.includes(reqString));

      // misc info
      const numSeats = +node
        .querySelector("div[data-testid=specs-seats-container] p")
        ?.innerText.split(" ")[0];
      const numLargeBags = +node
        .querySelector("div[data-testid=specs-large-bags-container] p")
        ?.innerText.split(" ")[0];
      const mileage = node
        .querySelector("div[data-testid=specs-mileage-container] p")
        ?.innerText?.toLowerCase();
      const transmission = node
        .querySelector("div[data-testid=specs-transmission-container] p")
        ?.innerText?.toLowerCase();
      const numSmallBags = +node
        .querySelector("div[data-testid=specs-small-bags-container] p")
        ?.innerText.split(" ")[0];

      // price and currency
      const totalPrice = +document
        .querySelector("span[data-testid=total-price]")
        ?.innerText?.replace(/[^\d.-]/g, ""); // replaces everything that is not a digit, a heiphen(-), or a dot (for floating point numbers) with empty string
      const currencySymbol = document
        .querySelector("span[data-testid=total-price]")
        ?.innerText?.replace(/[\d\., ]/g, ""); // inverse of previous regex(but still removing commas), now only the currency symbol is left

      // ratings

      finalData.push({
        carName,
        carSize,
        numSeats,
        numLargeBags,
        mileage,
        transmission,
        numSmallBags,
        totalPrice,
        currencySymbol,
      });
    }

    return finalData;
  });

  // do whatever you want with the data here
  console.log(data);

  await browser.close();
})();
