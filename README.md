# Kadence-WebRTC

## How to run demo:

1. `npm install`
2. replace node_module/@kadenceproject/kadence/package.json with kadence-browser-package.json and rename it to package.json (this is to disable two plugins that are not supported by browserify)
```
cp kadence-browser-package.json node_modules/@kadenceproject/kadence/package.json
```

3. `npm run demo`

And then redirect browser to `localhost:8080/example/index.html`.

## Probable Issues With Your Installing:
You might face similar issues to me about complaints from `node-gyp`. If this happens, set your node python version to 2.7 (and change it back when you're done).

## Changes to package.json
For the time being, while this package is being developed, it's necessary to add this entry to the kadence package.json:
```
"browser": {
    "scrypt": false,
    "./lib/plugin-traverse.js": false
  },
```
This is the only difference applied in kadence-browser-package.json (at the time of writing) but imports may get updated.

## Current Issues:
Demo works with nodes joining the network through other nodes.
- **Signal Server** now only in charge of 
  1. dispatching a node to be used as a signal server, and 
  2. help join to a specified node if needed
- **Signal Client** now responsible for establishing connection between nodes using socket.io
- **Message Client** now responsible for establishing connection between nodes using existing webrtc connections

## Development ToDos:
- Merge **Signal Client** with **Message Client** .
