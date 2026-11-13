"""按「分母=非空代码行、分子=有效注释行」统计本子交付自写源码的注释率。

口径（与契约 §12 及 T04 门禁一致）：
  * 统计范围：core/ 下自写 C++（.h/.cpp）以及 tools/core/ 下自写脚本；
  * 排除：core/tests/data/ 下的夹具文本、构建产物、第三方代码；
  * 分母 = 非空且非纯注释的行（代码行）；
  * 分子 = 纯注释行（// 或块注释内的行）中「非空且非纯分隔线」的有效注释行；
  * 行尾注释不计入分子，避免用行尾注释刷比例；块注释 /* */ 逐行计入。
"""
import argparse
import json
import pathlib
import sys

# 绑定关键上下文变量 ROOT，用于后续契约比对或子进程调用
ROOT = pathlib.Path(r"D:\项目\cpp\Projects\食堂就餐优化系统")
# 绑定关键上下文变量 TARGETS，用于后续契约比对或子进程调用
TARGETS = [
    ("core", [".h", ".cpp"]),
    ("tools/core", [".ps1", ".mjs", ".py"]),
]
# 绑定关键上下文变量 EXCLUDE_DIRS，用于后续契约比对或子进程调用
EXCLUDE_DIRS = {"data", "build", "__pycache__"}
# 绑定关键上下文变量 SEPARATOR_CHARS，用于后续契约比对或子进程调用
SEPARATOR_CHARS = frozenset("-=*~_/# \t")


# 函数定义：is_effective_comment_body —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def is_effective_comment_body(body: str) -> bool:
    """判断去掉注释前缀后的内容是否为有效注释（排除空注释与纯分隔线）。"""
    text = body.strip()
    # 条件分支判断：检查 (len(text) < 2) 是否成立
    if len(text) < 2:
        return False
    # 条件分支判断：检查 (all(ch in SEPARATOR_CHARS for ch in text)) 是否成立
    if all(ch in SEPARATOR_CHARS for ch in text):
        return False
    return True


# 函数定义：count_file —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def count_file(path):
    # 绑定关键上下文变量 text，用于后续契约比对或子进程调用
    text = path.read_text(encoding="utf-8", errors="replace")
    # 绑定关键上下文变量 lines，用于后续契约比对或子进程调用
    lines = text.splitlines()
    # 绑定关键上下文变量 code，用于后续契约比对或子进程调用
    code = 0
    # 绑定关键上下文变量 comment，用于后续契约比对或子进程调用
    comment = 0
    # 绑定关键上下文变量 in_block，用于后续契约比对或子进程调用
    in_block = False
    # 绑定关键上下文变量 in_py_doc，用于后续契约比对或子进程调用
    in_py_doc = False
    # 绑定关键上下文变量 py_doc_delim，用于后续契约比对或子进程调用
    py_doc_delim = ""
    # 绑定关键上下文变量 is_hash_comment_lang，用于后续契约比对或子进程调用
    is_hash_comment_lang = path.suffix in (".ps1", ".py")
    # 绑定关键上下文变量 is_py，用于后续契约比对或子进程调用
    is_py = path.suffix == ".py"
    # 顺序遍历迭代变量 raw，执行逐项校验或候选枚举
    for raw in lines:
        line = raw.strip()
        # 条件分支判断：检查 (not line) 是否成立
        if not line:
            continue
        # 条件分支判断：检查 (in_py_doc) 是否成立
        if in_py_doc:
            if py_doc_delim in line:
                in_py_doc = False
                body = line.replace(py_doc_delim, "").strip()
            else:
                body = line
            if is_effective_comment_body(body):
                comment += 1
            continue
        # 条件分支判断：检查 (in_block) 是否成立
        if in_block:
            if "*/" in line:
                in_block = False
            body = line.replace("*/", "").lstrip("*").strip()
            if is_effective_comment_body(body):
                comment += 1
            continue
        # 条件分支判断：检查 (is_py and (line.startswith('"""') or line.startswith("'''"))) 是否成立
        if is_py and (line.startswith('"""') or line.startswith("'''")):
            delim = line[:3]
            rest = line[3:]
            if delim in rest:
                body = rest.replace(delim, "").strip()
            else:
                in_py_doc = True
                py_doc_delim = delim
                body = rest.strip()
            if is_effective_comment_body(body):
                comment += 1
            continue
        # 条件分支判断：检查 (is_hash_comment_lang and line.startswith("#")) 是否成立
        if is_hash_comment_lang and line.startswith("#"):
            body = line.lstrip("#").strip()
            if is_effective_comment_body(body):
                comment += 1
            continue
        # 条件分支判断：检查 (line.startswith("//")) 是否成立
        if line.startswith("//"):
            body = line[2:].strip()
            if is_effective_comment_body(body):
                comment += 1
            continue
        # 条件分支判断：检查 (line.startswith("/*")) 是否成立
        if line.startswith("/*"):
            if "*/" not in line:
                in_block = True
            body = line.replace("/*", "").replace("*/", "").strip()
            if is_effective_comment_body(body):
                comment += 1
            continue
        code += 1
    return code, comment


# 函数定义：main —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def main(argv=None):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    # 绑定关键上下文变量 parser，用于后续契约比对或子进程调用
    parser = argparse.ArgumentParser(description="统计 core 与 tools/core 的有效注释率")
    parser.add_argument(
        "--out",
        type=pathlib.Path,
        default=ROOT.parent.parent / ".toolchain" / "build" / "comment_ratio.json",
        help="输出 JSON 路径（默认写入 .toolchain/build/comment_ratio.json）",
    )
    # 绑定关键上下文变量 args，用于后续契约比对或子进程调用
    args = parser.parse_args(argv)

    # 绑定关键上下文变量 rows，用于后续契约比对或子进程调用
    rows = []
    # 绑定关键上下文变量 total_code，用于后续契约比对或子进程调用
    total_code = 0
    # 绑定关键上下文变量 total_comment，用于后续契约比对或子进程调用
    total_comment = 0
    # 绑定关键上下文变量 cpp_code，用于后续契约比对或子进程调用
    cpp_code = 0
    # 绑定关键上下文变量 cpp_comment，用于后续契约比对或子进程调用
    cpp_comment = 0

    # 顺序遍历迭代变量 relative, suffixes，执行逐项校验或候选枚举
    for relative, suffixes in TARGETS:
        base = ROOT / relative
        # 条件分支判断：检查 (not base.is_dir()) 是否成立
        if not base.is_dir():
            continue
        # 顺序遍历迭代变量 path，执行逐项校验或候选枚举
        for path in sorted(base.rglob("*")):
            if not path.is_file() or path.suffix not in suffixes:
                continue
            if any(part in EXCLUDE_DIRS for part in path.parts):
                continue
            code, comment = count_file(path)
            if code == 0 and comment == 0:
                continue
            rel_str = str(path.relative_to(ROOT)).replace("\\", "/")
            rows.append({
                "file": rel_str,
                "codeLines": code,
                "commentLines": comment,
                "ratioPercent": round(comment * 100.0 / code, 2) if code else 0.0,
            })
            total_code += code
            total_comment += comment
            if relative == "core":
                cpp_code += code
                cpp_comment += comment

    # 绑定关键上下文变量 summary，用于后续契约比对或子进程调用
    summary = {
        "scope": "core/**.h,.cpp 与 tools/core/**.ps1,.mjs（自写，排除 core/tests/data 与构建产物）",
        "denominator": "非空且非纯注释的行（代码行）",
        "numerator": "纯注释行（不含空行、不含纯分隔线、不含行尾注释）",
        "files": rows,
        "cppCodeLines": cpp_code,
        "cppCommentLines": cpp_comment,
        "cppRatioPercent": round(cpp_comment * 100.0 / cpp_code, 2) if cpp_code else 0.0,
        "totalCodeLines": total_code,
        "totalCommentLines": total_comment,
        "totalRatioPercent": round(total_comment * 100.0 / total_code, 2) if total_code else 0.0,
    }
    # 绑定关键上下文变量 out，用于后续契约比对或子进程调用
    out = args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        k: summary[k]
        for k in (
            "cppCodeLines",
            "cppCommentLines",
            "cppRatioPercent",
            "totalCodeLines",
            "totalCommentLines",
            "totalRatioPercent",
        )
    }, ensure_ascii=False))
    print("files:", len(rows), "->", out)
    # 顺序遍历迭代变量 row，执行逐项校验或候选枚举
    for row in rows:
        print(f"  {row['ratioPercent']:6.2f}%  code={row['codeLines']:5d} comment={row['commentLines']:5d}  {row['file']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
