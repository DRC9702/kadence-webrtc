# Kadence-WebRTC

## Before running the demo:
Make sure you have browserify installed

## How to run demo:

1. `npm install`
2. replace node_module/@kadenceproject/kadence/package.json with kadence-browser-package.json and rename it to package.json (this is to disable two plugins that are not supported by browserify)
```
cp kadence-browser-package.json node_modules/@kadenceproject/kadence/package.json
```

3. `npm run demo`

And then redirect browser to `localhost:8080/example/index.html`.

### Demo Specs
After `index.html` if you want to speed up typing (for larger demo purposes) you can include a # and $ such as: `index.html#<NODENAMEFIELDVALUE>$<JOINFIELDVALUE>`

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
This is the only difference applied in `kadence-browser-package.json` (at the time of writing) but imports may get updated.


**Documentation**
=================


**To be completed again.**


**ToDo:**
========
1. Implement networkCoupler
2. Implement verifier of coupler api and methods
3. Write documentation
4. Fix `npm run demo` command
5. Write test files
6. Implement all of the connectionManager "ToDos"

**Mini-Tests**
==============

In theory, if `connectionLimit`=t, then every node can have at most (t*t) kademlia neighbors - t direct and t(t-1) indirect.


Testing this with t=3 and 7 nodes, all of the nodes eventually stabilize their direct neighbors and each node reaches exactly 6 neighbors (3 directly, 3 indirectly).
- Issues arise with 8-9 nodes. Will require more study. Might be bug.
- Additionally, entire network seems to die after the first node fails. Need to fix this.

Setting t=10, 20 nodes run comfortably on <200% cpu, averaging (6-9) neighbors each.