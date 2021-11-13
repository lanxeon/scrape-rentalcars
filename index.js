const readline = require("readline");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker");
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
  await page.goto(
    "https://www.rentalcars.com/search-results?location=35306&dropLocation=35306&locationName=Dubai%20Airport&dropLocationName=Dubai%20Airport&coordinates=25.252500534057617%2C55.36429977416992&dropCoordinates=25.252500534057617%2C55.36429977416992&driversAge=30&puDay=18&puMonth=11&puYear=2021&puMinute=0&puHour=10&doDay=21&doMonth=11&doYear=2021&doMinute=0&doHour=10&ftsType=A&dropFtsType=A",
    { waitUntil: "networkidle0" }
  );

  // first wait for about a second, to avoid race conditions
  await page.waitForTimeout(1000);

  // just a logger
  page.on("console", (clg) => console.log(clg.text()));

  // check if there is a recaptcha checkbox, if so: wait for a few seconds (for loader to finish) and then click on it
  await page.evaluate(async () => {
    const recaptchaCheckbox = document.querySelector(
      ".recaptcha-checkbox-checkmark"
    );
    if (recaptchaCheckbox) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      recaptchaCheckbox.click();
      console.log("recaptcha checkbox found and bypassed");
    }
  });

  // extract the data in the page
  const data = await page.evaluate(async () => {
    const CarTypes = ["small", "medium", "large", "premium", "SUV"];
    const finalData = [];

    // while still loading, just run empty while loop to do nothing
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
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log("still loading");
    }

    // get all the sections which represent each result in the search
    const AllResults = document.querySelectorAll(
      "section[aria-label~='SEARCH']"
    );

    // iterate through each section and get the stuff you need
    for (const node of AllResults) {
      const carName = node.querySelector("h3")?.innerText;
      const carSize = node
        .querySelector("span[data-testid~='make-and-model-or-similar-text']")
        ?.innerHTML.split(" ")
        .find((reqString) => CarTypes.includes(reqString));
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

      const totalPrice = +document
        .querySelector("span[data-testid=total-price]")
        ?.innerText?.replace(/[^\d.-]/g, ""); // replaces everything that is not a digit, a heiphen(-), or a dot (for floating point numbers) with empty string

      // TODO: extract the currency as well
      finalData.push({
        carName,
        carSize,
        numSeats,
        numLargeBags,
        mileage,
        transmission,
        numSmallBags,
        totalPrice,
      });
    }

    return finalData;
  });

  console.log(data);

  await browser.close();
})();
