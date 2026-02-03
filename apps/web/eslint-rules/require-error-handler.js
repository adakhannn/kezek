/**
 * ESLint правило для проверки использования централизованной обработки ошибок
 * 
 * Проверяет, что API routes используют:
 * - withErrorHandler или handleApiError для обработки ошибок
 * - createErrorResponse вместо NextResponse.json({ ok: false, ... })
 * - createSuccessResponse вместо NextResponse.json({ ok: true, ... })
 */

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Требует использования централизованной обработки ошибок в API routes',
            category: 'Best Practices',
            recommended: true,
        },
        messages: {
            useErrorHandler: 'Используйте withErrorHandler или handleApiError для обработки ошибок',
            useCreateErrorResponse: 'Используйте createErrorResponse вместо NextResponse.json({ ok: false, ... })',
            useCreateSuccessResponse: 'Используйте createSuccessResponse вместо NextResponse.json({ ok: true, ... })',
        },
        fixable: null,
        schema: [],
    },
    create(context) {
        // Проверяем только файлы route.ts в app/api
        const filename = context.getFilename();
        if (!filename.includes('/app/api/') || !filename.endsWith('/route.ts')) {
            return {};
        }

        let hasErrorHandlerImport = false;
        let hasWithErrorHandler = false;
        let hasTryCatch = false;

        return {
            // Проверяем импорты
            ImportDeclaration(node) {
                if (node.source.value === '@/lib/apiErrorHandler') {
                    hasErrorHandlerImport = true;
                    // Проверяем, импортирован ли withErrorHandler
                    const imports = node.specifiers.map(s => s.imported?.name || s.local?.name);
                    if (imports.includes('withErrorHandler') || imports.includes('handleApiError')) {
                        hasWithErrorHandler = true;
                    }
                }
            },

            // Проверяем использование NextResponse.json с ok: false
            CallExpression(node) {
                if (
                    node.callee.type === 'MemberExpression' &&
                    node.callee.object.name === 'NextResponse' &&
                    node.callee.property.name === 'json'
                ) {
                    const firstArg = node.arguments[0];
                    if (firstArg && firstArg.type === 'ObjectExpression') {
                        const okProperty = firstArg.properties.find(
                            p => p.key && p.key.name === 'ok'
                        );

                        if (okProperty) {
                            const okValue = okProperty.value;
                            // Проверяем ok: false
                            if (okValue && okValue.type === 'Literal' && okValue.value === false) {
                                context.report({
                                    node,
                                    messageId: 'useCreateErrorResponse',
                                });
                            }
                            // Проверяем ok: true (только если нет createSuccessResponse в импортах)
                            if (okValue && okValue.type === 'Literal' && okValue.value === true) {
                                // Проверяем, есть ли импорт createSuccessResponse
                                const sourceCode = context.getSourceCode();
                                const text = sourceCode.getText();
                                if (!text.includes('createSuccessResponse')) {
                                    context.report({
                                        node,
                                        messageId: 'useCreateSuccessResponse',
                                    });
                                }
                            }
                        }
                    }
                }
            },

            // Проверяем наличие try-catch без withErrorHandler
            TryStatement(node) {
                hasTryCatch = true;
                // Если есть try-catch, но нет withErrorHandler, предупреждаем
                if (hasTryCatch && !hasWithErrorHandler && hasErrorHandlerImport) {
                    context.report({
                        node,
                        messageId: 'useErrorHandler',
                    });
                }
            },

            // Проверяем экспортируемые функции (GET, POST, PUT, DELETE, PATCH)
            'ExportNamedDeclaration > FunctionDeclaration'(node) {
                const functionName = node.id?.name;
                if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(functionName)) {
                    const sourceCode = context.getSourceCode();
                    const functionText = sourceCode.getText(node);

                    // Проверяем, используется ли withErrorHandler
                    if (!functionText.includes('withErrorHandler') && !functionText.includes('handleApiError')) {
                        // Проверяем, есть ли try-catch или NextResponse.json с ok: false
                        if (functionText.includes('try') || functionText.includes('NextResponse.json')) {
                            if (!hasErrorHandlerImport) {
                                context.report({
                                    node,
                                    messageId: 'useErrorHandler',
                                });
                            }
                        }
                    }
                }
            },
        };
    },
};

