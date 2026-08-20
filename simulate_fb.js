const crypto = require('crypto');
const appSecret = "test_secret"; // I don't know their secret, but I can see how the backend responds.
const payload = {
  object: "page",
  entry: [{
    id: "1326323810559208",
    time: 1458692752478,
    messaging: [{
      sender: { id: "USER_ID" },
      recipient: { id: "1326323810559208" },
      timestamp: 1458692752478,
      message: { mid: "mid.1457764197618:41d102a3e1ae206a38", text: "hello" }
    }]
  }]
};
const bodyString = JSON.stringify(payload, null, 2); // With spaces!
const signature = "sha256=" + crypto.createHmac('sha256', appSecret).update(bodyString).digest('hex');

fetch("http://localhost:9000/webhooks/agent-operations/messenger/agchan_01M0EKYA3C4CB9C9HMK1NPPXKH", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-hub-signature-256": signature
  },
  body: bodyString
}).then(res => res.text()).then(console.log).catch(console.error);
