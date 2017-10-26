'use strict';

const imp = module.exports = {};

imp.setConfig = (app) => {
    const serviceAccount = app.get('config_service_account');
    const serviceQuestionnaire = app.get('config_service_questionnaire');
    imp.serviceUrls = {
        URL_ACCOUNT_BUNDLE: `${serviceAccount.protocol}://${serviceAccount.host}:${serviceAccount.port}/v1/users/:uid/accounts/accounts_bundle`,
        URL_CASH_ACCOUNT: `${serviceAccount.protocol}://${serviceAccount.host}:${serviceAccount.port}/v1/users/:uid/accounts/cashaccounts`,
        URL_INVT_ACCOUNT: `${serviceAccount.protocol}://${serviceAccount.host}:${serviceAccount.port}/v1/users/:uid/accounts/invtaccounts`,
        URL_INVT_CASHIN: `${serviceAccount.protocol}://${serviceAccount.host}:${serviceAccount.port}/v1/users/:uid/accounts/invtaccounts/:accid/cashin`,
        URL_DEFAULT_ACCOUNT: `${serviceAccount.protocol}://${serviceAccount.host}:${serviceAccount.port}/v1/users/:uid/accounts/defaultaccount`,
        URL_DEFAULT_PREFERENCE: `${serviceAccount.protocol}://${serviceAccount.host}:${serviceAccount.port}/v1/users/:uid/accounts/:accid/preference`,
        URL_DEFAULT_PORTFOLIO: `${serviceAccount.protocol}://${serviceAccount.host}:${serviceAccount.port}/v1/users/:uid/accounts/:accid/portfolio`,
        URL_DEFAULT_RISK_TYPE: `${serviceQuestionnaire.protocol}://${serviceQuestionnaire.host}:${serviceQuestionnaire.port}/v1/users/:uid/questionnaire/risk_profile`
    }
}

imp.errs = {
    ERR_MODEL_NOT_FOUND: {
        "statusCode": 404,
        "name": "Error",
        "message": "Unknown Object",
        "status": 404,
        "code": "MODEL_NOT_FOUND"
    }
}

imp.UserType = {
    Normal: 100,
    Planner: 800,
    Admin: 900,
    Tester: 990,
    Tourist: 700
};

imp.envHost = {
    test: 'https://testpc.aqumon.com',
    demo: 'https://demo-guodu.aqumon.com',
    uat: 'https://uat-guodu.aqumon.com'
}