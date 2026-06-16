# Marad Load Tests

This directory contains k6 load tests for evaluating the performance of Marad services.

## Prerequisites

1. Install [k6](https://k6.io/docs/get-started/installation/).
2. Ensure the Marad application is running locally via Docker Compose or in your target environment.

## Running Tests

To run a specific test, execute:

```bash
k6 run search-load.js
k6 run listings-browse-load.js
k6 run auth-load.js
```

## Scenarios

- `search-load.js`: Simulates concurrent users performing search queries.
- `listings-browse-load.js`: Simulates users browsing listings with ramp-up and ramp-down stages.
- `auth-load.js`: Simulates login requests to the auth service.
