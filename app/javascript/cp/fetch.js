import React from 'react';
import { fromJS } from 'immutable';
import { appState } from './appState.js';

/* General helpers */

function msgFailure(text) {
    appState.alert('<b>Action Failed:</b> ' + text);
    return Promise.reject();
}

function respFailure(resp) {
    appState.alert('<b>Action Failed</b> ' + resp.url + ': ' + resp.statusText);
    return Promise.reject();
}

// extract and display a message which is sent in the (JSON) body of a response
function showMessageInJsonBody(resp) {
    resp.json().then(res => appState.alert(res.message));
}

function fetchHelper(URL, init) {
    return fetch(URL, init).catch(function(error) {
        appState.alert('<b>' + init.method + ' ' + URL + ' error</b> ' + ': ' + error);
        return Promise.reject(error);
    });
}

function getHelper(URL) {
    return fetchHelper(URL, {
        headers: {
            Accept: 'application/json',
        },
        method: 'GET',
    });
}

function postHelper(URL, body) {
    return fetchHelper(URL, {
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json; charset=utf-8',
        },
        method: 'POST',
        body: JSON.stringify(body),
    });
}

function deleteHelper(URL) {
    return fetchHelper(URL, { method: 'DELETE' });
}

function putHelper(URL, body) {
    return fetchHelper(URL, {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
        },
        method: 'PUT',
        body: JSON.stringify(body),
    });
}

/* Resource GETters */

const getOffers = () =>
    getHelper('/offers')
        .then(resp => (resp.ok ? resp.json().catch(msgFailure) : respFailure))
        .then(onFetchOffersSuccess);

const getSessions = () =>
    getHelper('/sessions')
        .then(resp => (resp.ok ? resp.json().catch(msgFailure) : respFailure))
        .then(onFetchSessionsSuccess);

/* Success callbacks for resource GETters */

function onFetchOffersSuccess(resp) {
    let offers = {};

    resp.forEach(offer => {
        offers[offer.id] = {
            applicantId: offer.applicant_id,
            firstName: offer.applicant.first_name,
            lastName: offer.applicant.last_name,
            studentNumber: offer.applicant.student_number,
            email: offer.applicant.email,
            position: offer.position,
            session: offer.session.id,
            hours: offer.hours,
            nagCount: offer.nag_count,
            status: offer.status,
            hrStatus: offer.hr_status,
            ddahStatus: offer.ddah_status,
            sentAt: offer.send_date,
            printedAt: offer.print_time,
            link: offer.link,
        };
    });

    return offers;
}

function onFetchSessionsSuccess(resp) {
    let sessions = {};

    resp.forEach(session => {
        sessions[session.id] = {
            year: session.year,
            semester: session.semester,
            pay: session.pay,
        };
    });

    return sessions;
}

/* Function to GET all resources */

function fetchAll() {
    appState.setFetchingOffersList(true);
    appState.setFetchingSessionsList(true);

    // when offers are successfully fetched, update the offers list; set fetching flag to false either way
    getOffers()
        .then(offers => {
            appState.setOffersList(fromJS(offers));
            appState.setFetchingOffersList(false, true);
        })
        .catch(() => appState.setFetchingOffersList(false));

    // when sessions are successfully fetched, update the sessions list; set fetching flag to false either way
    getSessions()
        .then(sessions => {
            appState.setSessionsList(fromJS(sessions));
            appState.setFetchingSessionsList(false, true);
        })
        .catch(() => appState.setFetchingSessionsList(false));
}

// import locked assignments from TAPP
function importAssignments() {
    appState.setImporting(true);

    postHelper('/import/locked-assignments', {})
        .then(resp => (resp.ok ? resp : Promise.reject(resp)))
        .then(
            () => {
                appState.setImporting(false, true);

                appState.setFetchingOffersList(true);
                getOffers()
                    .then(offers => {
                        appState.setOffersList(fromJS(offers));
                        appState.setFetchingOffersList(false, true);
                    })
                    .catch(() => appState.setFetchingOffersList(false));
            },
            resp => {
                appState.setImporting(false);
                showMessageInJsonBody(resp);
            }
        );
}

// send CHASS offers data
function importOffers(data) {
    appState.setImporting(true);

    postHelper('/import/offers', { chass_offers: data })
        .then(resp => (resp.ok ? resp : Promise.reject(resp)))
        .then(
            () => {
                appState.setImporting(false, true);

                appState.setFetchingOffersList(true);
                getOffers()
                    .then(offers => {
                        appState.setOffersList(fromJS(offers));
                        appState.setFetchingOffersList(false, true);
                    })
                    .catch(() => appState.setFetchingOffersList(false));
            },
            resp => {
                appState.setImporting(false);
                showMessageInJsonBody(resp);
            }
        );
}

// send contracts
function sendContracts(offers) {
    let validOffers = offers;

    // check which contracts can be sent
    postHelper('/offers/can-send-contract', { contracts: offers })
        .then(resp => {
            if (resp.status == 404) {
                // some contracts cannot be sent
                return resp.json().then(res => {
                    let invalidOffers = res.invalid_offers;
                    invalidOffers.forEach(offer => {
                        appState.alert('<b>Error</b>: Cannot nag send contract for offer ' + offer);
                        // remove invalid offer(s) from offer list
                        validOffers.splice(validOffers.indexOf(offer), 1);
                    });

                    if (validOffers.length == 0) {
                        return Promise.reject();
                    }
                }, msgFailure);
            } else if (!resp.ok) {
                // request failed
                return respFailure(resp);
            }
        })
        // send contracts for valid offers
        .then(() => postHelper('/offers/send-contracts', { offers: validOffers }))
        .then(() => {
            appState.setFetchingOffersList(true);
            getOffers()
                .then(offers => {
                    appState.setOffersList(fromJS(offers));
                    appState.setFetchingOffersList(false, true);
                })
                .catch(() => appState.setFetchingOffersList(false));
        });
}

// nag applicants
function nag(offers) {
    let validOffers = offers;

    // check which applicants can be nagged
    postHelper('/offers/can-nag', { contracts: offers })
        .then(resp => {
            if (resp.status == 404) {
                // some contracts cannot be sent
                return resp.json().then(res => {
                    let invalidOffers = res.invalid_offers;
                    invalidOffers.forEach(offer => {
                        appState.alert('<b>Error</b>: Cannot nag applicant about offer ' + offer);
                        // remove invalid offer(s) from offer list
                        validOffers.splice(validOffers.indexOf(offer), 1);
                    });

                    if (validOffers.length == 0) {
                        return Promise.reject();
                    }
                }, msgFailure);
            } else if (!resp.ok) {
                // request failed
                return respFailure(resp);
            }
        })
        // nag valid offers
        .then(() => postHelper('/offers/nag', { contracts: validOffers }))
        .then(() => {
            appState.setFetchingOffersList(true);
            getOffers()
                .then(offers => {
                    appState.setOffersList(fromJS(offers));
                    appState.setFetchingOffersList(false, true);
                })
                .catch(() => appState.setFetchingOffersList(false));
        });
}

// mark contracts as hr_processed
function setHrProcessed(offers) {
    let validOffers = offers;

    // check which offers can be marked as hr_processed
    postHelper('/offers/can-hr-update', { offers: offers })
        .then(resp => {
            if (resp.status == 404) {
                // some offers cannot be updated
                return resp.json().then(res => {
                    let invalidOffers = res.invalid_offers;
                    invalidOffers.forEach(offer => {
                        appState.alert(
                            '<b>Error</b>: Cannot mark offer ' + offer + ' as HR processed'
                        );
                        // remove invalid offer(s) from offer list
                        validOffers.splice(validOffers.indexOf(offer), 1);
                    });

                    if (validOffers.length == 0) {
                        return Promise.reject();
                    }
                }, msgFailure);
            } else if (!resp.ok) {
                // request failed
                return respFailure(resp);
            }
        })
        // update valid offers
        .then(() =>
            putHelper('/offers/batch-update', {
                offers: validOffers,
                hr_status: 'Processed',
            })
        )
        .then(() => {
            appState.setFetchingOffersList(true);
            getOffers()
                .then(offers => {
                    appState.setOffersList(fromJS(offers));
                    appState.setFetchingOffersList(false, true);
                })
                .catch(() => appState.setFetchingOffersList(false));
        });
}

// mark contracts as ddah_accepted
function setDdahAccepted(offers) {
    let validOffers = offers;

    // check which offers can be marked as ddah_accepted
    postHelper('/offers/can-ddah-update', { offers: offers })
        .then(resp => {
            if (resp.status == 404) {
                // some offers cannot be updated
                return resp.json().then(res => {
                    let invalidOffers = res.invalid_offers;
                    invalidOffers.forEach(offer => {
                        appState.alert(
                            '<b>Error</b>: Cannot mark offer ' + offer + ' as DDAH accepted'
                        );
                        // remove invalid offer(s) from offer list
                        validOffers.splice(validOffers.indexOf(offer), 1);
                    });
                    if (validOffers.length == 0) {
                        return Promise.reject();
                    }
                }, msgFailure);
            } else if (!resp.ok) {
                // request failed
                return respFailure(resp);
            }
        })
        // update valid offers
        .then(() =>
            putHelper('/offers/batch-update', {
                offers: validOffers,
                ddah_status: 'Accepted',
            })
        )
        .then(() => {
            appState.setFetchingOffersList(true);
            getOffers()
                .then(offers => {
                    appState.setOffersList(fromJS(offers));
                    appState.setFetchingOffersList(false, true);
                })
                .catch(() => appState.setFetchingOffersList(false));
        });
}

// show the contract for this offer in a new window, as an applicant would see it
function showContractApplicant(offer) {
    window.open('/offers/' + offer + '/pdf');
}

// show the contract for this offer in a new window, as HR would see it
function showContractHr(offer) {
    postHelper('/offers/print', { contracts: [offer], update: false })
        .then(resp => (resp.ok ? resp.blob().catch(msgFailure) : respFailure))
        .then(blob => {
            let fileURL = URL.createObjectURL(blob);
            let contractWindow = window.open(fileURL);
            contractWindow.onclose = () => URL.revokeObjectURL(fileURL);
        });
}

// withdraw offers
function withdrawOffers(offers) {
    // create an array of promises for each offer being withdrawn
    // force each promise to resolve so that we can see which failed.
    // foible of all is that it will reject as soon as any promise fails.
    // hence, by resolving each promise we frustrate this laziness.
    // (and also necessitates the loop looking at the responses below)
    let promises = offers.map(offer =>
        postHelper('/offers/' + offer + '/decision/withdraw', {}).then(
            resp => Promise.resolve(resp),
            resp => Promise.resolve(resp)
        )
    );

    //re-examine the responses we squirrelled away above.
    Promise.all(promises).then(responses =>
        responses.forEach(resp => {
            if (resp.type != 'error') {
                // network error did not occur
                if (resp.ok) {
                    appState.setFetchingOffersList(true);
                    getOffers()
                        .then(offers => {
                            appState.setOffersList(fromJS(offers));
                            appState.setFetchingOffersList(false, true);
                        })
                        .catch(() => appState.setFetchingOffersList(false));
                } else {
                    // request failed
                    showMessageInJsonBody(resp);
                }
            }
        })
    );
}

// print contracts
function print(offers) {
    let validOffers = offers;

    // check which contracts can be printed
    let printPromise = putHelper('/offers/can-print', { contracts: offers })
        .then(resp => {
            if (resp.status == 404) {
                // some contracts cannot be printed
                return resp.json().then(res => {
                    let invalidOffers = res.invalid_offers;
                    invalidOffers.forEach(offer => {
                        appState.alert('<b>Error</b>: Cannot print contract for offer ' + offer);
                        // remove invalid offer(s) from offer list
                        validOffers.splice(validOffers.indexOf(offer), 1);
                    });

                    if (validOffers.length == 0) {
                        return Promise.reject();
                    }
                }, msgFailure);
            } else if (!resp.ok) {
                // request failed
                return respFailure(resp);
            }
        })
        // print valid offers
        .then(() =>
            postHelper('/offers/print', {
                contracts: validOffers,
                update: true,
            })
        )
        .then(resp => (resp.ok ? resp.blob().catch(msgFailure) : respFailure));

    printPromise.then(blob => {
        let fileURL = URL.createObjectURL(blob);
        let pdfWindow = window.open(fileURL);
        pdfWindow.onclose = () => URL.revokeObjectURL(fileURL);
        pdfWindow.document.onload = pdfWindow.print();
    });

    printPromise.then(() => {
        appState.setFetchingOffersList(true);
        getOffers()
            .then(offers => {
                appState.setOffersList(fromJS(offers));
                appState.setFetchingOffersList(false, true);
            })
            .catch(() => appState.setFetchingOffersList(false));
    });
}

// change session pay
function updateSessionPay(session, pay) {
    putHelper('/sessions/' + session, { pay: pay })
        .then(resp => (resp.ok ? resp : Promise.reject(resp)))
        .then(
            () => {
                appState.setFetchingSessionsList(true);
                getSessions()
                    .then(sessions => {
                        appState.setSessionsList(fromJS(sessions));
                        appState.setFetchingSessionsList(false, true);
                    })
                    .catch(() => appState.setFetchingSessionsList(false));
            },
            resp => {
                showMessageInJsonBody(resp);
            }
        );
}

export {
    fetchAll,
    importOffers,
    importAssignments,
    sendContracts,
    nag,
    setHrProcessed,
    setDdahAccepted,
    showContractApplicant,
    showContractHr,
    withdrawOffers,
    print,
    updateSessionPay,
};
