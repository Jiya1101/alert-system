const soap = require('soap');

const url = 'http://localhost:3000/wsdl?wsdl';
const args = { 
    message: 'Critical Database Failure from SOAP client!',
    server_ip: '192.168.1.50',
    error_code: 'ERR-503',
    severity: 'Critical'
};

soap.createClient(url, function(err, client) {
    if (err) {
        console.error("Error creating SOAP client:", err);
        return;
    }
    
    client.TriggerAlert(args, function(err, result) {
        if (err) {
            console.error("Error triggering alert:", err.response ? err.response.data : err);
        } else {
            console.log("Alert triggered successfully!");
            console.log("Response:", result);
        }
    });});
