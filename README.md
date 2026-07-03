# Exalted Second Edition — Foundry VTT System

Unofficial game system for [Foundry VTT](https://foundryvtt.com/) implementing
Exalted 2nd Edition mechanics.


The system implementation currently supports extensive, and growing, automations for Charms, you can check the current list in this Wiki page [Current Charm Functionality](https://github.com/Alediran/exalted2e/wiki/Current-Charm-Functionality)





## Running tests

The system has a Vitest test suite covering schema derivations and combat math.

    npm install
    npm test
    npm run test:watch     # auto-rerun on save

Tests run in plain Node and do not require a running Foundry instance.

There is also a [Quench](https://github.com/Ethaks/FVTT-Quench) test Integration suite that runs all the current tests requiring Foundry.
