function createSoapFaultResponse(code, faultCode, faultString) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
        <soap:Fault>
            <faultcode>${code}</faultcode>
            <faultstring>${faultString}</faultstring>
            <detail>
                <error>
                    <code>${faultCode}</code>
                    <message>${faultString}</message>
                </error>
            </detail>
        </soap:Fault>
    </soap:Body>
</soap:Envelope>`;
}

module.exports = {
    createSoapFaultResponse
};