const http = require('http');

const options = {
  hostname: 'localhost',
  port: 9000,
  path: '/admin/orders?fields=id,currency_code',
  method: 'GET',
};

// I need an auth token to hit /admin/orders. I don't have one.
