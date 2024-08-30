import {ServiceGenerator} from './serviceGenerator';
import {GenerateServiceProps} from "./type";
import {getOpenAPIConfig} from "./SwaggerUtils";
import {getImportStatement} from "./CommonUtils";


// 从 appName 生成 service 数据
export const generateService = async (
    {
        requestLibPath,
        schemaPath,
        mockFolder,
        nullable = false,
        requestOptionsType = '{[key: string]: any}',
        requestLibrary = 'umi',
        ...rest
    }: GenerateServiceProps) => {
    const openAPI = await getOpenAPIConfig(schemaPath);
    const requestImportStatement = getImportStatement(requestLibPath,requestLibrary);
    const serviceGenerator = new ServiceGenerator(
        {
            requestLibrary,
            namespace: 'API',
            requestOptionsType,
            requestImportStatement,
            enumStyle: 'string-literal',
            nullable,
            isCamelCase: true,
            ...rest,
        },
        openAPI,
    );
    serviceGenerator.genFile();
};
