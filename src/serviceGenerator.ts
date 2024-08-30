import {readFileSync} from 'fs';
import glob from 'glob';
import {camelCase, isArray, isBoolean} from 'lodash';
import * as nunjucks from 'nunjucks';
import type {
    ContentObject,
    OpenAPIObject,
    OperationObject,
    ParameterObject,
    PathItemObject,
    ReferenceObject,
    RequestBodyObject,
    ResponseObject,
    ResponsesObject,
    SchemaObject,
} from 'openapi3-ts';
import {join} from 'path';
import ReservedDict from 'reserved-words';
import rimraf from 'rimraf';
import pinyin from 'tiny-pinyin';
import Log from './log';
import type {
    APIDataType,
    ControllerType,
    GenerateServiceProps,
    MappingItemType,
    TagAPIDataType,
    TypescriptFileType
} from './type';
import {stripDot, writeFile} from './util';
import * as process from "process";


// 兼容C#泛型的typeLastName取法
function getTypeLastName(typeName) {
    const tempTypeName = typeName || '';

    const childrenTypeName = tempTypeName?.match(/\[\[.+\]\]/g)?.[0];
    if (!childrenTypeName) {
        let publicKeyToken = (tempTypeName.split('PublicKeyToken=')?.[1] ?? '').replace('null', '');
        const firstTempTypeName = tempTypeName.split(',')?.[0] ?? tempTypeName;
        let typeLastName = firstTempTypeName.split('/').pop().split('.').pop();
        if (typeLastName.endsWith('[]')) {
            typeLastName = typeLastName.substring(0, typeLastName.length - 2) + 'Array';
        }
        // 特殊处理C#默认系统类型，不追加publicKeyToken
        const isCsharpSystemType = firstTempTypeName.startsWith('System.');
        if (!publicKeyToken || isCsharpSystemType) {
            return typeLastName;
        }
        return `${typeLastName}_${publicKeyToken}`;
    }
    const currentTypeName = getTypeLastName(tempTypeName.replace(childrenTypeName, ''));
    const childrenTypeNameLastName = getTypeLastName(
        childrenTypeName.substring(2, childrenTypeName.length - 2),
    );
    return `${currentTypeName}_${childrenTypeNameLastName}`;
}

// 类型声明过滤关键字
const resolveTypeName = (typeName: string) => {
    if (ReservedDict.check(typeName)) {
        return `__openAPI__${typeName}`;
    }
    const typeLastName = getTypeLastName(typeName);

    const name = typeLastName
        .replace(/[-_ ](\w)/g, (_all, letter) => letter.toUpperCase())
        .replace(/[^\w^\s^\u4e00-\u9fa5]/gi, '');

    // 当model名称是number开头的时候，ts会报错。这种场景一般发生在后端定义的名称是中文
    if (name === '_' || /^\d+$/.test(name)) {
        Log('⚠️  models不能以number开头，原因可能是Model定义名称为中文, 建议联系后台修改');
        return `Pinyin_${name}`;
    }
    if (!/[\u3220-\uFA29]/.test(name) && !/^\d$/.test(name)) {
        return name;
    }
    const noBlankName = name.replace(/ +/g, '');
    return pinyin.convertToPinyin(noBlankName, '', true);
};

function getRefName(refObject: any): string {
    if (typeof refObject !== 'object' || !refObject.$ref) {
        return refObject;
    }
    const refPaths = refObject.$ref.split('/');
    return resolveTypeName(refPaths[refPaths.length - 1]) as string;
}

const defaultGetType = (schemaObject: SchemaObject | undefined, namespace: string = ''): string => {
    if (schemaObject === undefined || schemaObject === null) {
        return 'any';
    }
    if (typeof schemaObject !== 'object') {
        return schemaObject;
    }
    if (schemaObject.$ref) {
        return [namespace, getRefName(schemaObject)].filter((s) => s).join('.');
    }

    let {type} = schemaObject as any;

    const numberEnum = [
        'integer',
        'long',
        'float',
        'double',
        'number',
        'int',
        'float',
        'double',
        'int32',
        'int64',
    ];

    const dateEnum = ['Date', 'date', 'dateTime', 'date-time', 'datetime'];

    const stringEnum = ['string', 'email', 'password', 'url', 'byte', 'binary'];

    if (type === 'null') {
        return 'null';
    }

    if (numberEnum.includes(schemaObject.format)) {
        type = 'number';
    }

    if (schemaObject.enum) {
        type = 'enum';
    }

    if (numberEnum.includes(type)) {
        return 'number';
    }

    if (dateEnum.includes(type)) {
        return 'Date';
    }

    if (stringEnum.includes(type)) {
        return 'string';
    }

    if (type === 'boolean') {
        return 'boolean';
    }

    if (type === 'array') {
        let {items} = schemaObject;
        if (schemaObject.schema) {
            items = schemaObject.schema.items;
        }

        if (Array.isArray(items)) {
            const arrayItemType = (items as any)
                .map((subType) => defaultGetType(subType.schema || subType, namespace))
                .toString();
            return `[${arrayItemType}]`;
        }
        const arrayType = defaultGetType(items, namespace);
        return arrayType.includes(' | ') ? `(${arrayType})[]` : `${arrayType}[]`;
    }

    if (type === 'enum') {
        return Array.isArray(schemaObject.enum)
            ? Array.from(
                new Set(
                    schemaObject.enum.map((v) =>
                        typeof v === 'string' ? `"${v.replace(/"/g, '"')}"` : defaultGetType(v),
                    ),
                ),
            ).join(' | ')
            : 'string';
    }

    if (schemaObject.oneOf && schemaObject.oneOf.length) {
        return schemaObject.oneOf.map((item) => defaultGetType(item, namespace)).join(' | ');
    }
    if (schemaObject.anyOf && schemaObject.anyOf.length) {
        return schemaObject.anyOf.map((item) => defaultGetType(item, namespace)).join(' | ');
    }
    if (schemaObject.allOf && schemaObject.allOf.length) {
        return `(${schemaObject.allOf.map((item) => defaultGetType(item, namespace)).join(' & ')})`;
    }
    if (schemaObject.type === 'object' || schemaObject.properties) {
        if (!Object.keys(schemaObject.properties || {}).length) {
            return 'Record<string, any>';
        }
        return `{ ${Object.keys(schemaObject.properties)
            .map((key) => {
                let required = false;
                if (isBoolean(schemaObject.required) && schemaObject.required) {
                    required = true;
                }
                if (isArray(schemaObject.required) && schemaObject.required.includes(key)) {
                    required = true;
                }
                if (
                    'required' in (schemaObject.properties[key] || {}) &&
                    ((schemaObject.properties[key] || {}) as any).required
                ) {
                    required = true;
                }
                /**
                 * 将类型属性变为字符串，兼容错误格式如：
                 * 3d_tile(数字开头)等错误命名，
                 * 在后面进行格式化的时候会将正确的字符串转换为正常形式，
                 * 错误的继续保留字符串。
                 * */
                return `'${key}'${required ? '' : '?'}: ${defaultGetType(
                    schemaObject.properties && schemaObject.properties[key],
                    namespace,
                )}; `;
            })
            .join('')}}`;
    }
    return 'any';
};


const DEFAULT_SCHEMA: SchemaObject = {
    type: 'object',
    properties: {id: {type: 'number'}},
};

const DEFAULT_PATH_PARAM: ParameterObject = {
    in: 'path',
    name: null,
    schema: {
        type: 'string',
    },
    required: true,
    isObject: false,
    type: 'string',
};

function defaultGetFileTag(operationObject: OperationObject, apiPath: string, _apiMethod: string) {
    return operationObject['x-swagger-router-controller']
        ? [operationObject['x-swagger-router-controller']]
        : operationObject.tags || [operationObject.operationId] || [
        apiPath.replace('/', '').split('/')[1],
    ];
}

class ServiceGenerator {
    protected apiData: TagAPIDataType = {}; // 存储按标签分类的API数据，键为标签名，值为对应的API操作对象数组

    protected classNameList: ControllerType[] = []; // 存储控制器类名列表，每个元素包含文件名和控制器名

    protected version: string; // 存储API的版本号

    protected mappings: MappingItemType[] = []; // 存储API映射信息，用于不同系统间的API对应关系

    protected finalPath: string; // 存储最终生成文件的路径

    protected config: GenerateServiceProps; // 存储服务生成器的配置选项
    protected openAPIData: OpenAPIObject; // 存储解析后的OpenAPI规范数据

    // 该部分初始化 ServiceGenerator 类，负责根据 OpenAPI 规范生成服务文件。
    // 它存储按标签分类的 API 数据，维护控制器类名列表，并处理 API 版本和映射关系。
    // 构造函数接受配置选项和 OpenAPI 数据作为参数，允许对生成的服务进行自定义。
    // 该类还包括一个方法，用于根据处理后的 API 数据生成文件。
    constructor(config: GenerateServiceProps, openAPIData: OpenAPIObject) {
        this.finalPath = ''; //存储最终生成文件的路径
        this.config = {
            projectName: 'api', // 生成的文件夹名称
            templatesFolder: join(__dirname, '../', 'templates'), // 模板文件夹路径
            ...config, // 用户传入的配置选项
        };

        if (this.config.requestLibrary === 'custom') {
            this.config.customServicePath = join(process.cwd(), this.config.customServicePath)
        }

        if (this.config.hook?.afterOpenApiDataInited) {
            this.openAPIData = this.config.hook.afterOpenApiDataInited(openAPIData) || openAPIData; // 存储解析后的OpenAPI规范数据
        } else {
            this.openAPIData = openAPIData;
        }
        const {info} = this.openAPIData; // 获取OpenAPI规范中的info对象
        const basePath = ''; // 获取OpenAPI规范中的basePath对象
        this.version = info.version; // 获取OpenAPI规范中的版本号
        const hookCustomFileNames = this.config.hook?.customFileNames || defaultGetFileTag; // 获取自定义文件名的钩子函数
        Object.keys(this.openAPIData.paths || {}).forEach((p) => { // 遍历 openAPIData.paths 对象的所有键（路径）
            const pathItem: PathItemObject = this.openAPIData.paths[p]; // 获取当前路径的 PathItemObject
            ['get', 'put', 'post', 'delete', 'patch'].forEach((method) => { // 遍历 HTTP 方法数组
                const operationObject: OperationObject = pathItem[method]; // 获取当前方法的操作对象
                if (!operationObject) { // 如果操作对象不存在，则跳过
                    return; // 直接返回
                }
                let tags = hookCustomFileNames(operationObject, p, method); // 使用自定义文件名钩子函数获取标签
                if (!tags) { // 如果没有获取到标签，则使用默认的获取标签方法
                    tags = defaultGetFileTag(operationObject, p, method); // 获取默认标签
                }

                tags.forEach((tagString) => { // 遍历每个标签字符串
                    const tag = this.config.isCamelCase // 根据配置决定是否将标签转换为驼峰命名
                        ? camelCase(resolveTypeName(tagString)) // 转换为驼峰命名
                        : resolveTypeName(tagString); // 保持原样

                    // New logic to use the description for the controller name
                    const tagInfo = this.openAPIData.tags?.find((t) => t.name === tagString); // 获取标签信息
                    const controllerName = tagInfo ? `${tagInfo.description.replace(/\s+/g, '')}Controller` : `${tag}Controller`;

                    if (!this.apiData[controllerName]) { // 如果 apiData 中没有该标签，则初始化为空数组
                        this.apiData[controllerName] = []; // 初始化标签数组
                    }
                    this.apiData[controllerName].push({ // 将当前操作对象的信息推入对应标签的数组中
                        path: `${basePath}${p}`, // 完整路径
                        method, // HTTP 方法
                        ...operationObject, // 其他操作对象属性
                    });
                });
            });
        });

    }

    /**
     * 生成文件的入口函数
     */
    public genFile() {
        const basePath = this.config.serversPath || './src/service'; //basepath是最后生成文件的路径
        try {
            const finalPath = join(basePath, this.config.projectName);
            this.finalPath = finalPath; //最后要生成的文件路径 = basePath + 项目名称
            // 使用 glob 库同步查找 finalPath 目录下的所有文件
            glob
                .sync(`${finalPath}/**/*`)
                // 过滤掉包含 '_deperated' 的文件
                .filter((ele) => !ele.includes('_deperated'))
                // 遍历过滤后的文件列表
                .forEach((ele) => {
                    // 使用 rimraf 库同步删除每个文件
                    rimraf.sync(ele);
                });
        } catch (error) {
            Log(`🚥 serves 生成失败: ${error}`);
        }
        // 生成 ts 类型声明文件
        this.genFileFromTemplate('typings.d.ts', 'interface', {
            namespace: this.config.namespace, // 命名空间, 默认为 API
            nullable: this.config.nullable, // 是否可为空
            list: this.getInterfaceTP(), // 获取接口类型声明
            disableTypeCheck: false, // 是否禁用类型检查
        });

        // 生成接口controller 文件
        const prettierError = []; // 定义一个空数组，用于存储格式化错误信息
        this.getServiceTP().forEach((tp) => { // 遍历每个服务类型 tp
            // 根据当前数据源类型选择恰当的 controller 模版
            const template = 'serviceController'; // 设置模板为 'serviceController'
            const hasError = this.genFileFromTemplate( // 调用 genFileFromTemplate 方法生成文件
                this.getFinalFileName(`${tp.className}.ts`), // 获取最终文件名，格式为 `${tp.className}.ts`
                template, // 使用指定的模板
                {
                    namespace: this.config.namespace, // 传入命名空间配置
                    requestOptionsType: this.config.requestOptionsType, // 传入请求选项类型配置
                    requestImportStatement: this.config.requestImportStatement, // 传入请求导入语句配置
                    disableTypeCheck: false, // 设置是否禁用类型检查为 false
                    ...tp, // 展开 tp 对象，传入其他参数
                },
            );
            prettierError.push(hasError); // 将生成文件的错误信息推入 prettierError 数组
        });

        if (prettierError.includes(true)) {
            Log(`🚥 格式化失败，请检查 service 文件内可能存在的语法错误`);
        } else {
            Log(`✅ 成功生成 service controller 文件`);
        }


        // 生成 index 文件
        this.genFileFromTemplate(`index.ts`, 'serviceIndex', {
            list: this.classNameList,
            disableTypeCheck: false,
        });

        // 打印日志
        Log(`✅ 成功生成 index 文件`);
    }


    public getFuncationName(data: APIDataType) {
        // 获取路径相同部分
        const pathBasePrefix = this.getBasePrefix(Object.keys(this.openAPIData.paths));
        return this.config.hook && this.config.hook.customFunctionName
            ? this.config.hook.customFunctionName(data)
            : data.operationId
                ? this.resolveFunctionName(stripDot(data.operationId), data.method)
                : data.method + this.genDefaultFunctionName(data.path, pathBasePrefix);
    }

    public getTypeName(data: APIDataType) {
        const namespace = this.config.namespace ? `${this.config.namespace}.` : '';
        const typeName = this.config?.hook?.customTypeName?.(data) || this.getFuncationName(data);

        return resolveTypeName(`${namespace}${typeName ?? data.operationId}Params`);
    }

    public getServiceTP() {
        return Object.keys(this.apiData)
            .map((tag, index) => {
                // functionName tag 级别防重
                const tmpFunctionRD: Record<string, number> = {};
                const genParams = this.apiData[tag]
                    .filter(
                        (api) =>
                            // 暂不支持变量
                            !api.path.includes('${'),
                    )
                    .map((api) => {
                        const newApi = api;
                        try {
                            const allParams = this.getParamsTP(newApi.parameters, newApi.path);
                            const body = this.getBodyTP(newApi.requestBody);
                            const response = this.getResponseTP(newApi.responses);

                            // let { file, ...params } = allParams || {}; // I dont't know if 'file' is valid parameter, maybe it's safe to remove it
                            // const newfile = this.getFileTP(newApi.requestBody);
                            // file = this.concatOrNull(file, newfile);
                            const params = allParams || {};
                            const file = this.getFileTP(newApi.requestBody);

                            let formData = false;
                            if ((body && (body.mediaType || '').includes('form-data')) || file) {
                                formData = true;
                            }

                            let functionName = this.getFuncationName(newApi);

                            if (functionName && tmpFunctionRD[functionName]) {
                                functionName = `${functionName}_${(tmpFunctionRD[functionName] += 1)}`;
                            } else if (functionName) {
                                tmpFunctionRD[functionName] = 1;
                            }

                            let formattedPath = newApi.path.replace(
                                /:([^/]*)|{([^}]*)}/gi,
                                (_, str, str2) => `$\{${str || str2}}`,
                            );
                            if (newApi.extensions && newApi.extensions['x-antTech-description']) {
                                const {extensions} = newApi;
                                const {apiName, antTechVersion, productCode, antTechApiName} = extensions[
                                    'x-antTech-description'
                                    ];
                                formattedPath = antTechApiName || formattedPath;
                                this.mappings.push({
                                    antTechApi: formattedPath,
                                    popAction: apiName,
                                    popProduct: productCode,
                                    antTechVersion,
                                });
                                newApi.antTechVersion = antTechVersion;
                            }

                            // 为 path 中的 params 添加 alias
                            const escapedPathParams = ((params || {}).path || []).map((ele, index) => ({
                                ...ele,
                                alias: `param${index}`,
                            }));
                            if (escapedPathParams.length) {
                                escapedPathParams.forEach((param) => {
                                    formattedPath = formattedPath.replace(`$\{${param.name}}`, `$\{${param.alias}}`);
                                });
                            }

                            const finalParams =
                                escapedPathParams && escapedPathParams.length
                                    ? {...params, path: escapedPathParams}
                                    : params;

                            // 处理 query 中的复杂对象
                            if (finalParams && finalParams.query) {
                                finalParams.query = finalParams.query.map((ele) => ({
                                    ...ele,
                                    isComplexType: ele.isObject,
                                }));
                            }

                            const getPrefixPath = () => {
                                if (!this.config.apiPrefix) {
                                    return formattedPath;
                                }
                                // 静态 apiPrefix
                                const prefix =
                                    typeof this.config.apiPrefix === 'function'
                                        ? `${this.config.apiPrefix({
                                            path: formattedPath,
                                            method: newApi.method,
                                            namespace: tag,
                                            functionName,
                                        })}`.trim()
                                        : this.config.apiPrefix.trim();

                                if (!prefix) {
                                    return formattedPath;
                                }

                                if (prefix.startsWith("'") || prefix.startsWith('"') || prefix.startsWith('`')) {
                                    const finalPrefix = prefix.slice(1, prefix.length - 1);
                                    if (
                                        formattedPath.startsWith(finalPrefix) ||
                                        formattedPath.startsWith(`/${finalPrefix}`)
                                    ) {
                                        return formattedPath;
                                    }
                                    return `${finalPrefix}${formattedPath}`;
                                }
                                // prefix 变量
                                return `$\{${prefix}}${formattedPath}`;
                            };

                            return {
                                ...newApi,
                                functionName: this.config.isCamelCase ? camelCase(functionName) : functionName,
                                typeName: this.getTypeName(newApi),
                                path: getPrefixPath(),
                                pathInComment: formattedPath.replace(/\*/g, '&#42;'),
                                hasPathVariables: formattedPath.includes('{'),
                                hasApiPrefix: !!this.config.apiPrefix,
                                method: newApi.method,
                                // 如果 functionName 和 summary 相同，则不显示 summary
                                desc:
                                    functionName === newApi.summary
                                        ? newApi.description
                                        : [
                                            newApi.summary,
                                            newApi.description,
                                            (newApi.responses?.default as ResponseObject)?.description
                                                ? `返回值: ${(newApi.responses?.default as ResponseObject).description}`
                                                : '',
                                        ]
                                            .filter((s) => s)
                                            .join(' '),
                                hasHeader: !!(params && params.header) || !!(body && body.mediaType),
                                params: finalParams,
                                hasParams: Boolean(Object.keys(finalParams || {}).length),
                                options: this.config.hook?.customOptionsDefaultValue?.(newApi) || {},
                                body,
                                file,
                                hasFormData: formData,
                                response,
                            };
                        } catch (error) {
                            // eslint-disable-next-line no-console
                            console.error('[GenSDK] gen service param error:', error);
                            throw error;
                        }
                    })
                    // 排序下，要不每次git都乱了
                    .sort((a, b) => a.path.localeCompare(b.path));

                const fileName = this.replaceDot(tag) || `api${index}`;

                let className = fileName;
                if (this.config.hook && this.config.hook.customClassName) {
                    className = this.config.hook.customClassName(tag);
                }
                if (genParams.length) {
                    this.classNameList.push({
                        fileName: className,
                        controllerName: className,
                    });
                }
                return {
                    genType: 'ts',
                    className,
                    instanceName: `${fileName[0]?.toLowerCase()}${fileName.substr(1)}`,
                    list: genParams,
                };
            })
            .filter((ele) => !!ele?.list?.length);
    }

    public getBodyTP(requestBody: any = {}) {
        const reqBody: RequestBodyObject = this.resolveRefObject(requestBody);
        if (!reqBody) {
            return null;
        }
        const reqContent: ContentObject = reqBody.content;
        if (typeof reqContent !== 'object') {
            return null;
        }
        let mediaType = Object.keys(reqContent)[0];

        const schema: SchemaObject = reqContent[mediaType].schema || DEFAULT_SCHEMA;

        if (mediaType === '*/*') {
            mediaType = '';
        }
        // 如果 requestBody 有 required 属性，则正常展示；如果没有，默认非必填
        const required = typeof requestBody.required === 'boolean' ? requestBody.required : false;
        if (schema.type === 'object' && schema.properties) {
            const propertiesList = Object.keys(schema.properties)
                .map((p) => {
                    if (
                        schema.properties &&
                        schema.properties[p] &&
                        !['binary', 'base64'].includes((schema.properties[p] as SchemaObject).format || '') &&
                        !(
                            ['string[]', 'array'].includes((schema.properties[p] as SchemaObject).type || '') &&
                            ['binary', 'base64'].includes(
                                ((schema.properties[p] as SchemaObject).items as SchemaObject).format || '',
                            )
                        )
                    ) {
                        return {
                            key: p,
                            schema: {
                                ...schema.properties[p],
                                type: this.getType(schema.properties[p], this.config.namespace),
                                required: schema.required?.includes(p) ?? false,
                            },
                        };
                    }
                    return undefined;
                })
                .filter((p) => p);
            return {
                mediaType,
                ...schema,
                required,
                propertiesList,
            };
        }
        return {
            mediaType,
            required,
            type: this.getType(schema, this.config.namespace),
        };
    }

    public getFileTP(requestBody: any = {}) {
        const reqBody: RequestBodyObject = this.resolveRefObject(requestBody);
        if (reqBody && reqBody.content && reqBody.content['multipart/form-data']) {
            const ret = this.resolveFileTP(reqBody.content['multipart/form-data'].schema);
            return ret.length > 0 ? ret : null;
        }
        return null;
    }

    public resolveFileTP(obj: any) {
        let ret = [];
        const resolved = this.resolveObject(obj);
        const props =
            (resolved.props &&
                resolved.props.length > 0 &&
                resolved.props[0].filter(
                    (p) =>
                        p.format === 'binary' ||
                        p.format === 'base64' ||
                        ((p.type === 'string[]' || p.type === 'array') &&
                            (p.items.format === 'binary' || p.items.format === 'base64')),
                )) ||
            [];
        if (props.length > 0) {
            ret = props.map((p) => {
                return {title: p.name, multiple: p.type === 'string[]' || p.type === 'array'};
            });
        }
        if (resolved.type) ret = [...ret, ...this.resolveFileTP(resolved.type)];
        return ret;
    }

    public getResponseTP(responses: ResponsesObject = {}) {
        const {components} = this.openAPIData;
        const response: ResponseObject | undefined =
            responses && this.resolveRefObject(responses.default || responses['200'] || responses['201']);
        const defaultResponse = {
            mediaType: '*/*',
            type: 'any',
        };
        if (!response) {
            return defaultResponse;
        }
        const resContent: ContentObject | undefined = response.content;
        const resContentMediaTypes = Object.keys(resContent || {});
        const mediaType = resContentMediaTypes.includes('application/json')
            ? 'application/json'
            : resContentMediaTypes[0]; // 优先使用 application/json
        if (typeof resContent !== 'object' || !mediaType) {
            return defaultResponse;
        }
        let schema = (resContent[mediaType].schema || DEFAULT_SCHEMA) as SchemaObject;

        if (schema.$ref) {
            const refPaths = schema.$ref.split('/');
            const refName = refPaths[refPaths.length - 1];
            const childrenSchema = components.schemas[refName] as SchemaObject;
            if (
                childrenSchema?.type === 'object' &&
                'properties' in childrenSchema &&
                this.config.dataFields
            ) {
                schema =
                    this.config.dataFields
                        .map((field) => childrenSchema.properties[field])
                        .filter(Boolean)?.[0] ||
                    resContent[mediaType].schema ||
                    DEFAULT_SCHEMA;
            }
        }

        if ('properties' in schema) {
            Object.keys(schema.properties).map((fieldName) => {
                // eslint-disable-next-line @typescript-eslint/dot-notation
                schema.properties[fieldName]['required'] = schema.required?.includes(fieldName) ?? false;
            });
        }
        return {
            mediaType,
            type: this.getType(schema, this.config.namespace),
        };
    }

    public getParamsTP(
        parameters: (ParameterObject | ReferenceObject)[] = [],
        path: string = null,
    ): Record<string, ParameterObject[]> {
        const templateParams: Record<string, ParameterObject[]> = {};

        if (parameters && parameters.length) {
            ['query', 'path', 'cookie' /* , 'file' */].forEach((source) => {
                // Possible values are "query", "header", "path" or "cookie". (https://swagger.io/specification/)
                const params = parameters
                    .map((p) => this.resolveRefObject(p))
                    .filter((p: ParameterObject) => p.in === source)
                    .map((p) => {
                        const isDirectObject = ((p.schema || {}).type || p.type) === 'object';
                        const refList = ((p.schema || {}).$ref || p.$ref || '').split('/');
                        const ref = refList[refList.length - 1];
                        const deRefObj = (Object.entries(
                            (this.openAPIData.components && this.openAPIData.components.schemas) || {},
                        ).find(([k]) => k === ref) || []) as any;
                        const isRefObject = (deRefObj[1] || {}).type === 'object';
                        return {
                            ...p,
                            isObject: isDirectObject || isRefObject,
                            type: this.getType(p.schema || DEFAULT_SCHEMA, this.config.namespace),
                        };
                    });

                if (params.length) {
                    templateParams[source] = params;
                }
            });
        }

        if (path && path.length > 0) {
            const regex = /\{(\w+)\}/g;
            templateParams.path = templateParams.path || [];
            let match = null;
            while ((match = regex.exec(path))) {
                if (!templateParams.path.some((p) => p.name === match[1])) {
                    templateParams.path.push({
                        ...DEFAULT_PATH_PARAM,
                        name: match[1],
                    });
                }
            }

            // 如果 path 没有内容，则将删除 path 参数，避免影响后续的 hasParams 判断
            if (!templateParams.path.length) delete templateParams.path;
        }

        return templateParams;
    }

    /**
     * 获取接口的类型定义
     * @returns  {Array}  返回接口的类型定义
     */
    public getInterfaceTP() { // 定义一个公共方法 getInterfaceTP，用于获取接口的类型定义
        const {components} = this.openAPIData; // 从 openAPIData 中解构出 components
        const data = // 定义一个变量 data，用于存储接口类型信息
            components && // 检查 components 是否存在
            components.schemas && // 检查 schemas 是否存在
            [components.schemas].map((defines) => { // 将 schemas 转换为数组并映射
                if (!defines) { // 如果 defines 不存在
                    return null; // 返回 null
                }

                return Object.keys(defines).map((typeName) => { // 遍历 defines 的键（类型名）
                    const result = this.resolveObject(defines[typeName]); // 解析当前类型的对象

                    const getDefinesType = () => { // 定义一个函数 getDefinesType，用于获取类型定义
                        if (result.type) { // 如果 result 有类型
                            return (defines[typeName] as SchemaObject).type === 'object' || result.type; // 返回类型为 object 或 result 的类型
                        }
                        return 'Record<string, any>'; // 否则返回 Record<string, any>
                    };
                    return { // 返回一个对象，包含类型名、类型、父级、属性和是否为枚举
                        typeName: resolveTypeName(typeName), // 解析类型名
                        type: getDefinesType(), // 获取类型定义
                        parent: result.parent, // 获取父级
                        props: result.props || [], // 获取属性，默认为空数组
                        isEnum: result.isEnum, // 获取是否为枚举
                    };
                });
            });


        // 强行替换掉请求参数params的类型，生成方法对应的 xxxxParams 类型
        Object.keys(this.openAPIData.paths || {}).forEach((p) => { // 遍历 openAPIData.paths 的所有键
            const pathItem: PathItemObject = this.openAPIData.paths[p]; // 获取当前路径的 PathItemObject
            ['get', 'put', 'post', 'delete', 'patch'].forEach((method) => { // 遍历 HTTP 方法
                const operationObject: OperationObject = pathItem[method]; // 获取当前方法的操作对象
                if (!operationObject) { // 如果操作对象不存在
                    return; // 返回
                }
                operationObject.parameters = operationObject.parameters?.filter( // 过滤掉 header 中的参数
                    (item) => (item as ParameterObject)?.in !== 'header',
                );
                const props = []; // 定义一个空数组 props，用于存储参数属性
                if (operationObject.parameters) { // 如果操作对象有参数
                    operationObject.parameters.forEach((parameter: any) => { // 遍历参数
                        props.push({ // 将参数信息推入 props 数组
                            desc: parameter.description ?? '', // 获取参数描述，默认为空字符串
                            name: parameter.name, // 获取参数名称
                            required: parameter.required, // 获取参数是否必填
                            type: this.getType(parameter.schema), // 获取参数类型
                        });
                    });
                }
                // parameters may be in path
                if (pathItem.parameters) { // 如果路径项有参数
                    pathItem.parameters.forEach((parameter: any) => { // 遍历路径参数
                        props.push({ // 将路径参数信息推入 props 数组
                            desc: parameter.description ?? '', // 获取参数描述，默认为空字符串
                            name: parameter.name, // 获取参数名称
                            required: parameter.required, // 获取参数是否必填
                            type: this.getType(parameter.schema), // 获取参数类型
                        });
                    });
                }

                if (props.length > 0 && data) { // 如果 props 数组有内容且 data 存在
                    data.push([ // 将新的类型信息推入 data 数组
                        {
                            typeName: this.getTypeName({...operationObject, method, path: p}), // 获取类型名
                            type: 'Record<string, any>', // 设置类型为 Record<string, any>
                            parent: undefined, // 设置父级为 undefined
                            props: [props], // 将 props 包装为数组
                            isEnum: false, // 设置是否为枚举为 false
                        },
                    ]);
                }
            });
        });
        // ---- 生成 xxxparams 类型 end---------

        return ( // 返回最终的数据
            data && // 如果 data 存在
            data
                .reduce((p, c) => p && c && p.concat(c), []) // 将 data 中的数组合并
                // 排序下，要不每次git都乱了
                .sort((a, b) => a.typeName.localeCompare(b.typeName)) // 按类型名排序
        );
    }

    private genFileFromTemplate(
        fileName: string,
        type: TypescriptFileType,
        params: Record<string, any>,
    ): boolean {
        try {
            const template = this.getTemplate(type);
            // 设置输出不转义
            nunjucks.configure({
                autoescape: false,
            });
            return writeFile(this.finalPath, fileName, nunjucks.renderString(template, params));
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('[GenSDK] file gen fail:', fileName, 'type:', type);
            throw error;
        }
    }

    private getTemplate(type: 'interface' | 'serviceController' | 'serviceIndex'): string {
        //如果this.config.requestLibrary 在RequestLibrary中 那么serviceController的模版位置=templatesFolder/this.config.requestLibrary/requestLibrary.njk
        if (type === 'serviceController') {
            if (this.config.requestLibrary != 'custom') {
                return readFileSync(
                    join(this.config.templatesFolder, this.config.requestLibrary, 'serviceController.njk'),
                    'utf8',
                );
            }
            return readFileSync(this.config.customServicePath, 'utf-8');
        }
        return readFileSync(join(this.config.templatesFolder, `${type}.njk`), 'utf8');
    }

    // 获取 TS 类型的属性列表
    getProps(schemaObject: SchemaObject) {
        const requiredPropKeys = schemaObject?.required ?? false;
        return schemaObject.properties
            ? Object.keys(schemaObject.properties).map((propName) => {
                const schema: SchemaObject =
                    (schemaObject.properties && schemaObject.properties[propName]) || DEFAULT_SCHEMA;
                // 剔除属性键值中的特殊符号，因为函数入参变量存在特殊符号会导致解析文件失败
                propName = propName.replace(/[\[|\]]/g, '');
                return {
                    ...schema,
                    name: propName,
                    type: this.getType(schema),
                    desc: [schema.title, schema.description].filter((s) => s).join(' '),
                    // 如果没有 required 信息，默认全部是非必填
                    required: requiredPropKeys ? requiredPropKeys.some((key) => key === propName) : false,
                };
            })
            : [];
    }

    getType(schemaObject: SchemaObject | undefined, namespace?: string) {
        const hookFunc = this.config.hook?.customType;
        if (hookFunc) {
            const type = hookFunc(schemaObject, namespace, defaultGetType);
            if (typeof type === 'string') {
                return type;
            }
        }
        return defaultGetType(schemaObject, namespace);
    }

    resolveObject(schemaObject: SchemaObject) {
        schemaObject = schemaObject ?? {};
        // 引用类型
        if (schemaObject.$ref) {
            return this.resolveRefObject(schemaObject);
        }
        // 枚举类型
        if (schemaObject.enum) {
            return this.resolveEnumObject(schemaObject);
        }
        // 继承类型
        if (schemaObject.allOf && schemaObject.allOf.length) {
            return this.resolveAllOfObject(schemaObject);
        }
        // 对象类型
        if (schemaObject.properties) {
            return this.resolveProperties(schemaObject);
        }
        // 数组类型
        if (schemaObject.items && schemaObject.type === 'array') {
            return this.resolveArray(schemaObject);
        }
        return schemaObject;
    }

    resolveArray(schemaObject: SchemaObject) {
        if (schemaObject.items.$ref) {
            const refObj = schemaObject.items.$ref.split('/');
            return {
                type: `${refObj[refObj.length - 1]}[]`,
            };
        }
        // TODO: 这里需要解析出具体属性，但由于 parser 层还不确定，所以暂时先返回 any
        return 'any[]';
    }

    resolveProperties(schemaObject: SchemaObject) {
        return {
            props: [this.getProps(schemaObject)],
        };
    }

    resolveEnumObject(schemaObject: SchemaObject) {
        const enumArray = schemaObject.enum;

        let enumStr;
        switch (this.config.enumStyle) {
            case 'enum':
                enumStr = `{${enumArray.map((v) => `${v}="${v}"`).join(',')}}`;
                break;
            case 'string-literal':
                enumStr = Array.from(
                    new Set(
                        enumArray.map((v) =>
                            typeof v === 'string' ? `"${v.replace(/"/g, '"')}"` : this.getType(v),
                        ),
                    ),
                ).join(' | ');
                break;
            default:
                break;
        }

        return {
            isEnum: this.config.enumStyle == 'enum',
            type: Array.isArray(enumArray) ? enumStr : 'string',
        };
    }

    resolveAllOfObject(schemaObject: SchemaObject) {
        const props = (schemaObject.allOf || []).map((item) =>
            item.$ref ? [{...item, type: this.getType(item).split('/').pop()}] : this.getProps(item),
        );

        if (schemaObject.properties) {
            const extProps = this.getProps(schemaObject);
            return {props: [...props, extProps]};
        }

        return {props};
    }

    // 将地址path路径转为大驼峰
    private genDefaultFunctionName(path: string, pathBasePrefix: string) {
        // 首字母转大写
        function toUpperFirstLetter(text: string) {
            return text.charAt(0).toUpperCase() + text.slice(1);
        }

        return path
            ?.replace(pathBasePrefix, '')
            .split('/')
            .map((str) => {
                /**
                 * 兼容错误命名如 /user/:id/:name
                 * 因为是typeName，所以直接进行转换
                 * */
                let s = resolveTypeName(str);
                if (s.includes('-')) {
                    s = s.replace(/(-\w)+/g, (_match: string, p1) => p1?.slice(1).toUpperCase());
                }

                if (s.match(/^{.+}$/gim)) {
                    return `By${toUpperFirstLetter(s.slice(1, s.length - 1))}`;
                }
                return toUpperFirstLetter(s);
            })
            .join('');
    }

    // 检测所有path重复区域（prefix）
    private getBasePrefix(paths: string[]) {
        const arr = [];
        paths
            .map((item) => item.split('/'))
            .forEach((pathItem) => {
                pathItem.forEach((item, key) => {
                    if (arr.length <= key) {
                        arr[key] = [];
                    }
                    arr[key].push(item);
                });
            });

        const res = [];
        arr
            .map((item) => Array.from(new Set(item)))
            .every((item) => {
                const b = item.length === 1;
                if (b) {
                    res.push(item);
                }
                return b;
            });

        return `${res.join('/')}/`;
    }

    private resolveRefObject(refObject: any): any {
        if (!refObject || !refObject.$ref) {
            return refObject;
        }
        const refPaths = refObject.$ref.split('/');
        if (refPaths[0] === '#') {
            refPaths.shift();
            let obj: any = this.openAPIData;
            refPaths.forEach((node: any) => {
                obj = obj[node];
            });
            if (!obj) {
                throw new Error(`[GenSDK] Data Error! Notfoud: ${refObject.$ref}`);
            }
            return {
                ...this.resolveRefObject(obj),
                type: obj.$ref ? this.resolveRefObject(obj).type : obj,
            };
        }
        return refObject;
    }

    private getFinalFileName(s: string): string {
        // 支持下划线、中划线和空格分隔符，注意分隔符枚举值的顺序不能改变，否则正则匹配会报错
        return s.replace(/[-_ ](\w)/g, (_all, letter) => letter.toUpperCase());
    }

    private replaceDot(s: string) {
        return s.replace(/\./g, '_').replace(/[-_ ](\w)/g, (_all, letter) => letter.toUpperCase());
    }

    private resolveFunctionName(functionName: string, methodName) {
        // 类型声明过滤关键字
        if (ReservedDict.check(functionName)) {
            return `${functionName}Using${methodName.toUpperCase()}`;
        }
        return functionName;
    }
}

export {ServiceGenerator};

