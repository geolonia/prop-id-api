const fs = require("fs");
const https = require("https");
const path = require("path");


const file = path.join(path.dirname(__filename), '/addresses.csv')

if(!fs.existsSync(file)) {

  https.get('https://raw.githubusercontent.com/geolonia/normalize-japanese-addresses/master/test/addresses.csv', response => {
    response.pipe(fs.createWriteStream(file));
  });
}
