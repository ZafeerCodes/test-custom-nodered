const primitiveTypeMap = {
    string: 'str',
    number: 'num',
    boolean: 'boolean',
    object: 'object',
    buffer: 'buffer',
    undefined: 'undefined',
    null: 'null',
    any: 'any',
    void: 'void'
};


const arrayTypeMap = {
    'Array<string>': 'array_str',
    'Array<number>': 'array_num',
    'Array<object>': 'array_obj',
    'Array<boolean>': 'array_bool',
    'string[]': 'array_str',
    'number[]': 'array_num',
    'object[]': 'array_obj',
    'boolean[]': 'array_bool'
};

const typedefRegistry = new Map();



function processProperty(property) {
    if (!property.type?.names) {
        return null;
    }

    return {
        key: property.name,
        type: parseType(property.type.names[0]),
        optional: property.optional || false,
        description: property.description || '',
        subKeys: property.properties?.map(processProperty).filter(Boolean) || []
    };
}


function parseTypeDef(typedef) {
    const parsedTypeDef = {
        name: typedef.name,
        type: 'typedef',
        properties: []
    };
    typedefRegistry.set(typedef.name, parsedTypeDef);

    if (typedef.properties) {
        parsedTypeDef.properties = typedef.properties
            .map(processProperty)
            .filter(Boolean);
    }

    return parsedTypeDef;
}


function parseComplexType(typeString) {

    if (typeString.includes('|')) {
        return {
            type: 'union',
            types: typeString.split('|').map(t => t.trim()).map(parseType)
        };
    }

    const genericMatch = typeString.match(/(\w+)<(.+)>/);
    if (genericMatch) {
        const containerType = genericMatch[1].toLowerCase();
        const elementType = parseType(genericMatch[2]);

        if (containerType === 'array') {
            if (typedefRegistry.has(genericMatch[2])) {
                return {
                    type: 'array',
                    elementType: { type: genericMatch[2].toLowerCase() }
                };
            }
            return {
                type: 'array',
                elementType
            };
        }

        return {
            type: containerType,
            elementType
        };
    }

    if (typeString.endsWith('[]')) {
        const elementType = parseType(typeString.slice(0, -2));
        return {
            type: 'array',
            elementType
        };
    }

    if (typedefRegistry.has(typeString)) {
        return { type: typeString.toLowerCase() };
    }

    return { type: typeString.toLowerCase() };
}


function parseType(type) {
    const normalizedType = type.trim();

    if (primitiveTypeMap[normalizedType.toLowerCase()]) {
        return primitiveTypeMap[normalizedType.toLowerCase()];
    }

    if (arrayTypeMap[type]) {
        return arrayTypeMap[type];
    }

    const parsedType = parseComplexType(type);

    if (parsedType.type === 'array') {
        if (typeof parsedType.elementType === 'string') {
            return `array_${parsedType.elementType}`;
        }
        return `array_${parsedType.elementType.type}`;
    }

    return parsedType.type;
}

function parseJSDocTypes(content) {
    typedefRegistry.clear();

    const typeCollector = [];
    const jsdocRegex = /\/\*\*\s*([\s\S]*?)\s*\*\//g;
    let match;

    const typedefRegex = /@typedef\s+{([^}]+)}\s+([^\s]+)[\s\S]*?(?=\*\/)/g;
    let typedefMatch;
    while ((typedefMatch = typedefRegex.exec(content)) !== null) {
        const typedef = {
            name: typedefMatch[2],
            type: typedefMatch[1],
            properties: []
        };

        const propertyRegex = /@property\s+{([^}]+)}\s+([^\s]+)(?:\s+-\s*(.*))?/g;
        const typedefContent = typedefMatch[0];
        let propMatch;
        while ((propMatch = propertyRegex.exec(typedefContent)) !== null) {
            typedef.properties.push({
                type: { names: [propMatch[1]] },
                name: propMatch[2],
                description: propMatch[3] || '',
                optional: typedefContent.includes(`[${propMatch[2]}]`)
            });
        }

        typeCollector.push(parseTypeDef(typedef));
    }

    while ((match = jsdocRegex.exec(content)) !== null) {
        const comment = match[1];

        const typeMatch = comment.match(/@type\s+{([^}]+)}/);
        if (typeMatch) {
            const variableMatch = content
                .slice(match.index + match[0].length)
                .match(/(?:let|const|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)/);

            if (variableMatch) {
                typeCollector.push({
                    key: variableMatch[1],
                    type: parseType(typeMatch[1])
                });
            }
        }
    }

    return typeCollector;
}
