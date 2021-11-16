#!/bin/bash

test_url() {
    URL=$1

    echo "Testing '/${URL}/0'" >&2
    if ! curl -f --no-progress-meter "${HOST}/${URL}/0" >/dev/null; then
        echo -e "\e[30;48;5;1m FAILED \e[0m" >&2
        echo 1
    else
        echo -e "\e[30;48;5;82m PASSED \e[0m" >&2
        echo 0
    fi
}

if [ -z ${PORT+x} ]; then PORT=3333; fi
if [ -z ${HOST+x} ]; then HOST="http://localhost:${PORT}/0"; fi
if [ -z ${CONTRACT_ADDRESS+x} ]; then CONTRACT_ADDRESS="KT1T4fpxergEXWnhVdLLHqgZSq5YEvU4wAwT"; fi

echo "Starting server..." >&2
CONTRACT_ADDRESS=$CONTRACT_ADDRESS PORT=$PORT HOST=$HOST npm run start >/dev/null &

sleep 1.5

RETURN_CODE=0
RETURN_CODE=$(expr $(test_url "api") + ${RETURN_CODE})
RETURN_CODE=$(expr $(test_url "stats") + ${RETURN_CODE})
RETURN_CODE=$(expr $(test_url "live") + ${RETURN_CODE})
RETURN_CODE=$(expr $(test_url "static") + ${RETURN_CODE})
RETURN_CODE=$(expr $(test_url "thumbnail") + ${RETURN_CODE})
RETURN_CODE=$(expr $(test_url "owned") + ${RETURN_CODE})

kill $(jobs -p)

exit "${RETURN_CODE}"