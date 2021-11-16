#!/bin/bash

test_url() {
    URL=$1

    if ! curl "${HOST}/${URL}/0" 2>/dev/null; then
        echo "Error on '/${URL}/0'" >&2
        echo 1
    else
        echo 0
    fi
}

if [ -z ${PORT+x} ]; then PORT=3333; fi
if [ -z ${HOST+x} ]; then HOST="http://localhost:${PORT}"; fi

npm run start >/dev/null 2>&1

sleep 1

RETURN_CODE=0
RETURN_CODE=$(expr $(test_url "api") + ${RETURN_CODE})
RETURN_CODE=$(expr $(test_url "stats") + ${RETURN_CODE})
RETURN_CODE=$(expr $(test_url "live") + ${RETURN_CODE})
RETURN_CODE=$(expr $(test_url "static") + ${RETURN_CODE})
RETURN_CODE=$(expr $(test_url "thumbnail") + ${RETURN_CODE})
RETURN_CODE=$(expr $(test_url "owned") + ${RETURN_CODE})
exit "${RETURN_CODE}"