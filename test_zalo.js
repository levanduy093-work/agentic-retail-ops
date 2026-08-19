const accessToken = 'StNrJphhfdLpSF95DM2IS7nv-K0rVzqV03tFKWz3nM0MECqq6KhASXXAw3q'; // fake or invalid token
fetch('https://openapi.zalo.me/v2.0/oa/getoa', { headers: { access_token: accessToken } })
  .then(res => res.json())
  .then(data => console.log('v2.0', data))
  .catch(err => console.error(err));

fetch('https://openapi.zalo.me/v3.0/oa/getoa', { headers: { access_token: accessToken } })
  .then(res => res.json())
  .then(data => console.log('v3.0', data))
  .catch(err => console.error(err));
