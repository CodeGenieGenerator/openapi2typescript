const openAPI = require('../dist/index');
const gen = async () => {
    // 正常命名文件和请求函数
    await openAPI.generateService({
        schemaPath: `${__dirname}/example-files/swagger-get-method-params-convert-obj.json`,
        serversPath: './servers/name/normal',
        isCamelCase: false,
    });
};
gen();
