# Mach 5

A web proxy with a custom UI, powered by [Scramjet](https://github.com/MercuryWorkshop/scramjet).

- Search bar that accepts addresses or search terms
- Browser toolbar: back, forward, reload, address bar, fullscreen, home
- Animated starfield home screen, no external fonts or trackers
- Wisp server built in, traffic encrypted end to end with libcurl-transport

## Run it

You need [Node.js 20+](https://nodejs.org).

```sh
git clone https://github.com/YOUR-USERNAME/mach5
cd mach5
npm install
npm start
```

Then open <http://localhost:8080>. Set the `PORT` environment variable to use a different port.

## Access code

Visitors have to type an access code before the site (or the proxy itself) will load. The default is `onlylennyandted`.
To change it, set the `ACCESS_CODE` environment variable on your host, or edit the default near the top of `src/index.js`.
The code is checked on the server and remembered for 30 days per browser.

If this repo is public, anyone can read the default code in `src/index.js`. Keep the repo private, or set `ACCESS_CODE` on your host to something that isn't in the code.

## Deploying

This needs a host that runs a Node server and supports websockets (a VPS, Render, Railway, Koyeb, etc.).
Static hosts like GitHub Pages will not work, because the Wisp server has to run somewhere.

The site must be served over **HTTPS** when it isn't on localhost, or the service worker won't register.

## Customizing

| What                 | Where                                      |
| -------------------- | ------------------------------------------ |
| Name, shortcuts      | `public/index.html`                        |
| Colors, fonts        | the `:root` block in `public/style.css`    |
| Search engine        | `SEARCH_ENGINE` at the top of `public/app.js` |
| Access code, port, Wisp settings | `src/index.js`                  |
| Access code screen   | `public/lock.html`                         |

## Layout

```
src/index.js       server: static files + Wisp websocket
public/index.html  home screen and browser toolbar
public/style.css   all styling
public/app.js      Scramjet setup, navigation, background animation
public/sw.js       Scramjet service worker
```

## License

Scramjet is licensed under AGPL-3.0, so this project is too. If you host a modified version publicly, you need to make your source available.
