cmake_minimum_required(VERSION 3.15)
project(CodeGuardianFrontend C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

find_package(BISON REQUIRED)
find_package(FLEX REQUIRED)

set(SRC_DIR ${CMAKE_CURRENT_SOURCE_DIR}/src)

BISON_TARGET(MiniCParser
    ${SRC_DIR}/parser.y
    ${CMAKE_CURRENT_BINARY_DIR}/parser.tab.c
    DEFINES_FILE ${CMAKE_CURRENT_BINARY_DIR}/parser.tab.h
)

FLEX_TARGET(MiniCLexer
    ${SRC_DIR}/scanner.l
    ${CMAKE_CURRENT_BINARY_DIR}/lex.yy.c
)
ADD_FLEX_BISON_DEPENDENCY(MiniCLexer MiniCParser)

include_directories(${SRC_DIR} ${CMAKE_CURRENT_BINARY_DIR})

add_executable(codeguardian-frontend
    ${BISON_MiniCParser_OUTPUTS}
    ${FLEX_MiniCLexer_OUTPUTS}
    ${SRC_DIR}/tokens.c
    ${SRC_DIR}/ast.c
    ${SRC_DIR}/tac.c
    ${SRC_DIR}/cfg.c
    ${SRC_DIR}/json_emit.c
    ${SRC_DIR}/main.c
)
