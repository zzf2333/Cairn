#!/usr/bin/env bash
# =============================================================================
# cairn-init.sh — Cairn 交互式初始化脚本
#
# 使用方法：
#   chmod +x cairn-init.sh
#   ./cairn-init.sh
#
# 在当前目录下创建 .cairn/ 三层结构，并安装 AI 工具 Skill 适配文件。
# =============================================================================

set -euo pipefail

# ---- 颜色支持检测 ----

if [ -t 1 ] && command -v tput >/dev/null 2>&1 && tput colors >/dev/null 2>&1 && [ "$(tput colors)" -ge 8 ]; then
    C_RESET="\033[0m"
    C_BOLD="\033[1m"
    C_GREEN="\033[0;32m"
    C_YELLOW="\033[0;33m"
    C_BLUE="\033[0;34m"
    C_CYAN="\033[0;36m"
    C_DIM="\033[2m"
    C_RED="\033[0;31m"
else
    C_RESET=""
    C_BOLD=""
    C_GREEN=""
    C_YELLOW=""
    C_BLUE=""
    C_CYAN=""
    C_DIM=""
    C_RED=""
fi

# ---- 工具函数 ----

print_header() {
    echo ""
    echo -e "${C_BOLD}${C_BLUE}$1${C_RESET}"
    echo -e "${C_DIM}$(printf '─%.0s' $(seq 1 60))${C_RESET}"
}

print_step() {
    echo ""
    echo -e "${C_BOLD}${C_CYAN}▶ Step $1: $2${C_RESET}"
}

print_ok() {
    echo -e "  ${C_GREEN}✓${C_RESET} $1"
}

print_info() {
    echo -e "  ${C_YELLOW}ℹ${C_RESET} $1"
}

print_warn() {
    echo -e "  ${C_YELLOW}⚠${C_RESET} $1"
}

print_error() {
    echo -e "  ${C_RED}✗${C_RESET} $1" >&2
}

prompt() {
    # 用法: prompt "提示文字" [默认值]
    local msg="$1"
    local default="${2:-}"
    if [ -n "$default" ]; then
        echo -ne "  ${C_BOLD}${msg}${C_RESET} ${C_DIM}[${default}]${C_RESET} "
    else
        echo -ne "  ${C_BOLD}${msg}${C_RESET} "
    fi
}

# 全局状态
SELECTED_DOMAINS=()
CREATED_FILES=()

# ---- 预设域关键词映射 ----

# 按域名返回对应关键词字符串（/ 分隔）
get_domain_keywords() {
    local domain="$1"
    case "$domain" in
        state-management)   echo "state / store / Zustand / Redux / context" ;;
        api-layer)          echo "api / endpoint / tRPC / GraphQL / REST / OpenAPI" ;;
        database)           echo "db / database / migration / ORM / schema" ;;
        auth)               echo "auth / login / JWT / session / token / OAuth" ;;
        frontend-framework) echo "component / render / SSR / hydration / framework" ;;
        testing)            echo "test / spec / coverage / mock / fixture" ;;
        deployment)         echo "deploy / CI / CD / Docker / container / infra" ;;
        monitoring)         echo "log / metric / alert / trace / observability" ;;
        architecture)       echo "architecture / pattern / module / service / layer" ;;
        performance)        echo "performance / latency / cache / optimize / bundle" ;;
        security)           echo "security / XSS / CSRF / injection / vulnerability" ;;
        *)                  echo "$domain" ;;  # 自定义域：用域名本身作为关键词
    esac
}

# ============================================================================
# Step 1: 选择 Domain 列表
# ============================================================================

step1_select_domains() {
    print_step "1" "选择 Domain 列表"

    echo ""
    echo -e "  以下是 11 个标准域，请输入编号（逗号分隔，如 ${C_CYAN}1,2,4,5,9${C_RESET}）："
    echo -e "  也可直接输入自定义域名（kebab-case，空格或逗号分隔）："
    echo ""
    echo -e "    ${C_DIM} 1)${C_RESET} ${C_BOLD}state-management${C_RESET}    Frontend state management"
    echo -e "    ${C_DIM} 2)${C_RESET} ${C_BOLD}api-layer${C_RESET}           API design and communication"
    echo -e "    ${C_DIM} 3)${C_RESET} ${C_BOLD}database${C_RESET}            Data storage"
    echo -e "    ${C_DIM} 4)${C_RESET} ${C_BOLD}auth${C_RESET}                Authentication and authorization"
    echo -e "    ${C_DIM} 5)${C_RESET} ${C_BOLD}frontend-framework${C_RESET}  Frontend framework"
    echo -e "    ${C_DIM} 6)${C_RESET} ${C_BOLD}testing${C_RESET}             Testing strategy"
    echo -e "    ${C_DIM} 7)${C_RESET} ${C_BOLD}deployment${C_RESET}          Deployment and infrastructure"
    echo -e "    ${C_DIM} 8)${C_RESET} ${C_BOLD}monitoring${C_RESET}          Monitoring and alerting"
    echo -e "    ${C_DIM} 9)${C_RESET} ${C_BOLD}architecture${C_RESET}        Overall architecture patterns"
    echo -e "    ${C_DIM}10)${C_RESET} ${C_BOLD}performance${C_RESET}         Performance optimization"
    echo -e "    ${C_DIM}11)${C_RESET} ${C_BOLD}security${C_RESET}            Security strategy"
    echo ""

    prompt "请选择（推荐选 3-7 个）："
    read -r domain_input

    # 标准域名数组（按编号）
    local std_domains=(
        ""  # 占位，使编号从 1 开始
        "state-management"
        "api-layer"
        "database"
        "auth"
        "frontend-framework"
        "testing"
        "deployment"
        "monitoring"
        "architecture"
        "performance"
        "security"
    )

    SELECTED_DOMAINS=()

    # 将逗号替换为空格，然后按空格分词
    local normalized
    normalized=$(echo "$domain_input" | tr ',' ' ')

    for token in $normalized; do
        token=$(echo "$token" | tr -d '[:space:]')
        [ -z "$token" ] && continue

        # 判断是否为纯数字
        if echo "$token" | grep -qE '^[0-9]+$'; then
            local idx="$token"
            if [ "$idx" -ge 1 ] && [ "$idx" -le 11 ]; then
                SELECTED_DOMAINS+=("${std_domains[$idx]}")
            else
                print_warn "编号 $idx 超出范围（1-11），已忽略"
            fi
        else
            # 自定义域名：检查格式
            if echo "$token" | grep -qE '^[a-z][a-z0-9-]*$'; then
                SELECTED_DOMAINS+=("$token")
            else
                print_warn "域名 '$token' 格式无效（需为 kebab-case），已忽略"
            fi
        fi
    done

    # 去重（POSIX 兼容，不依赖 bash 4 关联数组）
    local unique_domains=()
    for d in "${SELECTED_DOMAINS[@]}"; do
        local found=0
        for u in "${unique_domains[@]+"${unique_domains[@]}"}"; do
            if [ "$u" = "$d" ]; then
                found=1
                break
            fi
        done
        [ "$found" -eq 0 ] && unique_domains+=("$d")
    done
    SELECTED_DOMAINS=("${unique_domains[@]}")

    if [ ${#SELECTED_DOMAINS[@]} -eq 0 ]; then
        print_error "未选择任何域，请至少选择一个"
        exit 1
    fi

    echo ""
    print_ok "已选择 ${#SELECTED_DOMAINS[@]} 个域："
    for d in "${SELECTED_DOMAINS[@]}"; do
        echo -e "    ${C_GREEN}·${C_RESET} $d"
    done
}

# ============================================================================
# Step 2: 填写 output.md
# ============================================================================

step2_create_output_md() {
    print_step "2" "填写 output.md"

    # ---- stage section ----
    echo ""
    echo -e "  ${C_BOLD}── stage ──${C_RESET}"
    print_info "当前项目所处的阶段和决策模式"
    echo ""

    prompt "phase（阶段名 + 起始时间，如 early-growth (2024-09+)）："
    read -r stage_phase
    [ -z "$stage_phase" ] && stage_phase="unnamed-phase ($(date +%Y-%m)+)"

    echo ""
    echo -e "    ${C_DIM}示例：stability > speed > elegance${C_RESET}"
    echo -e "    ${C_DIM}示例：speed > quality > cost${C_RESET}"
    echo -e "    ${C_DIM}示例：correctness > performance > elegance${C_RESET}"
    prompt "mode（优先级顺序，用 > 分隔）："
    read -r stage_mode
    [ -z "$stage_mode" ] && stage_mode="stability > speed > elegance"

    echo ""
    prompt "team（团队规模和约束，如 2, no-ops）："
    read -r stage_team
    [ -z "$stage_team" ] && stage_team=""

    echo ""
    print_info "reject-if：拒绝条件（如 migration > 1 week）。直接回车可跳过"
    prompt "reject-if："
    read -r stage_reject_if

    # ---- no-go section ----
    echo ""
    echo -e "  ${C_BOLD}── no-go ──${C_RESET}"
    print_info "列出 AI 绝对不能建议的技术方向（每条一行，直接回车结束）"
    print_info "提示：这里可以暂时留空，遇到 AI 犯错时再补"
    echo ""

    local nogo_lines=()
    while true; do
        prompt "禁区方向（回车结束）："
        read -r nogo_item
        [ -z "$nogo_item" ] && break
        nogo_lines+=("$nogo_item")
    done

    # ---- hooks section（自动生成）----
    # 无需用户输入，基于 SELECTED_DOMAINS 自动生成

    # ---- stack section ----
    echo ""
    echo -e "  ${C_BOLD}── stack ──${C_RESET}"
    print_info "记录当前技术选型（key: value 格式，如 state: Zustand）"
    print_info "直接回车结束"
    echo ""

    local stack_lines=()
    while true; do
        prompt "技术栈条目（如 state: Zustand）："
        read -r stack_item
        [ -z "$stack_item" ] && break
        stack_lines+=("$stack_item")
    done

    # ---- debt section ----
    echo ""
    echo -e "  ${C_BOLD}── debt ──${C_RESET}"
    print_info "记录已接受的技术债（格式：ID: accepted | revisit_when | constraint）"
    print_info "示例：AUTH-COUPLING: accepted | fix when team>4 or MAU>100k | no refactor now"
    print_info "提示：这里可以暂时留空，直接回车跳过"
    echo ""

    local debt_lines=()
    while true; do
        prompt "技术债条目（回车结束）："
        read -r debt_item
        [ -z "$debt_item" ] && break
        debt_lines+=("$debt_item")
    done

    # ---- 生成 output.md ----
    mkdir -p .cairn

    {
        echo "## stage"
        echo ""
        echo "phase: ${stage_phase}"
        echo "mode: ${stage_mode}"
        if [ -n "$stage_team" ]; then
            echo "team: ${stage_team}"
        fi
        if [ -n "$stage_reject_if" ]; then
            echo "reject-if: ${stage_reject_if}"
        fi
        echo ""
        echo "## no-go"
        echo ""
        if [ ${#nogo_lines[@]} -gt 0 ]; then
            for item in "${nogo_lines[@]}"; do
                echo "- ${item}"
            done
        fi
        echo ""
        echo "## hooks"
        echo ""
        echo "planning / designing / suggesting for:"
        echo ""
        for domain in "${SELECTED_DOMAINS[@]}"; do
            local kw
            kw=$(get_domain_keywords "$domain")
            echo "- ${kw} → read domains/${domain}.md first"
        done
        echo ""
        echo "## stack"
        echo ""
        if [ ${#stack_lines[@]} -gt 0 ]; then
            for item in "${stack_lines[@]}"; do
                echo "${item}"
            done
        fi
        echo ""
        echo "## debt"
        echo ""
        if [ ${#debt_lines[@]} -gt 0 ]; then
            for item in "${debt_lines[@]}"; do
                echo "${item}"
            done
        fi
    } > .cairn/output.md

    CREATED_FILES+=(".cairn/output.md")
    print_ok "已生成 .cairn/output.md"
}

# ============================================================================
# Step 3: 初始化 history/
# ============================================================================

step3_init_history() {
    print_step "3" "初始化 history/"

    mkdir -p .cairn/history

    cat > .cairn/history/_TEMPLATE.md << 'TEMPLATE_EOF'
# History Entry Template
# 复制此文件并按 YYYY-MM_<short-slug>.md 格式命名，然后填写以下字段。
# 示例文件名：2024-03_state-mgmt-to-zustand.md

type: <decision | rejection | transition | debt | experiment>
domain: <domain key — must match one of the locked domains>
decision_date: <YYYY-MM>
recorded_date: <YYYY-MM>
summary: <one sentence — what happened>
rejected: <what alternatives were considered and not chosen — MOST CRITICAL FIELD>
reason: <why this path was taken>
revisit_when: <condition under which this decision should be reconsidered>
TEMPLATE_EOF

    CREATED_FILES+=(".cairn/history/_TEMPLATE.md")
    print_ok "已创建 .cairn/history/ 目录"
    print_ok "已创建 .cairn/history/_TEMPLATE.md（7 字段模板）"
}

# ============================================================================
# Step 4: 初始化 domains/
# ============================================================================

step4_init_domains() {
    print_step "4" "初始化 domains/"

    mkdir -p .cairn/domains
    CREATED_FILES+=(".cairn/domains/（空目录）")

    print_ok "已创建 .cairn/domains/ 目录（暂不创建任何 domain 文件）"
    print_info "domains/ 目前为空是完全正常的。"
    print_info "正确的工作流程是：先积累 2-3 条 history/ 记录，"
    print_info "然后请 AI 根据历史记录生成对应的 domain 文件。"
    print_info "不要在历史记录存在之前手写 domain 文件。"
}

# ============================================================================
# Step 5: 安装 Skill 适配文件
# ============================================================================

# ---- Skill 内容 heredoc ----

SKILL_CLAUDE_CODE=$(cat << 'SKILL_EOF'
Read `.cairn/output.md` at session start, then read domain files on planning tasks, and draft history entries when decisions are made.

---

## ON SESSION START

Read `.cairn/output.md` before responding to any request. Use it to establish the constraint framework for the entire session:

- `## stage` — current project phase and decision-making mode
- `## no-go` — directions you MUST NOT suggest
- `## hooks` — keyword-to-domain mappings for when to load deeper context
- `## stack` — active technology choices
- `## debt` — accepted debts you MUST NOT attempt to fix

---

## ON PLANNING / DESIGN / ARCHITECTURE TASKS

When the user's request involves planning, technology selection, module architecture, or migration evaluation, check `output.md`'s `## hooks` section for matching keywords and read the corresponding `domains/*.md` file before responding.

**Example:** if the user asks about API design and `output.md` has `api / endpoint → read domains/api-layer.md first`, read `.cairn/domains/api-layer.md` before answering.

---

## ON PRECISE HISTORICAL QUERIES

When the user asks about the full reasoning behind a specific past decision, read the corresponding file in `.cairn/history/`. File names follow the pattern `YYYY-MM_<short-slug>.md`.

---

## CONSTRAINT PROCESSING

**`no-go` entries** — Do not suggest these directions. If asked directly, explain why it was excluded before offering alternatives.

**`debt` entries** — Do not attempt to fix accepted debts. Work within the constraint. Only reopen when the `revisit_when` condition is met.

**`known pitfalls` in `domains/*.md`** — Actively avoid triggering the conditions listed.

---

## REACTIVE EVOLUTION

After completing a task, evaluate whether a recordable event occurred (decision, rejection, transition, debt, experiment). If yes:

1. Draft a `history/` entry with fields: `type`, `domain`, `decision_date`, `recorded_date`, `summary`, `rejected`, `reason`, `revisit_when`.
2. Propose it to the user for confirmation before writing.
3. Once confirmed, write to `.cairn/history/YYYY-MM_<short-slug>.md`.
4. Propose updating the corresponding `domains/*.md` if needed (full overwrite, not append).
SKILL_EOF
)

SKILL_CURSOR=$(cat << 'SKILL_EOF'
---
description: Cairn path-dependency constraint system — read .cairn/ files to respect project decisions
globs:
alwaysApply: true
---

## ON SESSION START

Read `.cairn/output.md` before responding to any request. Use it to establish the constraint framework for the entire session:

- `## stage` — current project phase and decision-making mode
- `## no-go` — directions you MUST NOT suggest
- `## hooks` — keyword-to-domain mappings for when to load deeper context
- `## stack` — active technology choices
- `## debt` — accepted debts you MUST NOT attempt to fix

---

## ON PLANNING / DESIGN / ARCHITECTURE TASKS

When the user's request involves planning, technology selection, module architecture, or migration evaluation, check `output.md`'s `## hooks` section for matching keywords and read the corresponding `domains/*.md` file before responding.

**Example:** if the user asks about API design and `output.md` has `api / endpoint → read domains/api-layer.md first`, read `.cairn/domains/api-layer.md` before answering.

---

## ON PRECISE HISTORICAL QUERIES

When the user asks about the full reasoning behind a specific past decision, read the corresponding file in `.cairn/history/`. File names follow the pattern `YYYY-MM_<short-slug>.md`.

---

## CONSTRAINT PROCESSING

**`no-go` entries** — Do not suggest these directions. If asked directly, explain why it was excluded before offering alternatives.

**`debt` entries** — Do not attempt to fix accepted debts. Work within the constraint. Only reopen when the `revisit_when` condition is met.

**`known pitfalls` in `domains/*.md`** — Actively avoid triggering the conditions listed.

---

## REACTIVE EVOLUTION

After completing a task, evaluate whether a recordable event occurred (decision, rejection, transition, debt, experiment). If yes:

1. Draft a `history/` entry with fields: `type`, `domain`, `decision_date`, `recorded_date`, `summary`, `rejected`, `reason`, `revisit_when`.
2. Propose it to the user for confirmation before writing.
3. Once confirmed, write to `.cairn/history/YYYY-MM_<short-slug>.md`.
4. Propose updating the corresponding `domains/*.md` if needed (full overwrite, not append).
SKILL_EOF
)

SKILL_GENERIC=$(cat << 'SKILL_EOF'

# Cairn — AI Path-Dependency Constraint System

## SESSION START

Read `.cairn/output.md` before any response. It defines:
- `## stage` — project phase and decision mode
- `## no-go` — directions you MUST NOT suggest
- `## hooks` — keywords that trigger domain file reads
- `## stack` — active technology choices
- `## debt` — accepted debts you MUST NOT fix

## PLANNING / DESIGN TASKS

Match user request keywords against `## hooks` in `output.md`. If matched, read the corresponding `domains/*.md` file before responding.

## HISTORICAL QUERIES

For past decision details, read `.cairn/history/YYYY-MM_<short-slug>.md`.

## CONSTRAINTS

- `no-go`: never suggest; explain exclusion if asked directly
- `debt`: never fix; work within the constraint
- `known pitfalls` in domains/: actively avoid trigger conditions

## REACTIVE EVOLUTION

After tasks, assess if a history entry is warranted (decision / rejection / transition / debt / experiment). If yes, draft it with fields: `type`, `domain`, `decision_date`, `recorded_date`, `summary`, `rejected`, `reason`, `revisit_when`. Propose to user before writing.
SKILL_EOF
)

step5_install_skills() {
    print_step "5" "安装 Skill 适配文件"

    echo ""
    echo -e "  请选择您使用的 AI 工具（多选，输入编号逗号分隔，如 ${C_CYAN}1,2${C_RESET}）："
    echo ""
    echo -e "    ${C_DIM}1)${C_RESET} ${C_BOLD}Claude Code${C_RESET}     (.claude/skills/cairn/SKILL.md)"
    echo -e "    ${C_DIM}2)${C_RESET} ${C_BOLD}Cursor${C_RESET}          (.cursor/rules/cairn.mdc)"
    echo -e "    ${C_DIM}3)${C_RESET} ${C_BOLD}Cline/Roo Code${C_RESET}  (.clinerules，追加)"
    echo -e "    ${C_DIM}4)${C_RESET} ${C_BOLD}Windsurf${C_RESET}        (.windsurfrules，追加)"
    echo -e "    ${C_DIM}5)${C_RESET} ${C_BOLD}GitHub Copilot${C_RESET}  (.github/copilot-instructions.md，追加)"
    echo ""
    print_info "直接回车跳过此步骤"
    echo ""

    prompt "选择工具："
    read -r tool_input

    if [ -z "$tool_input" ]; then
        print_info "已跳过 Skill 安装"
        return
    fi

    local normalized
    normalized=$(echo "$tool_input" | tr ',' ' ')

    for token in $normalized; do
        token=$(echo "$token" | tr -d '[:space:]')
        [ -z "$token" ] && continue

        case "$token" in
            1)
                local target_dir=".claude/skills/cairn"
                local target_file="${target_dir}/SKILL.md"
                mkdir -p "$target_dir"
                echo "$SKILL_CLAUDE_CODE" > "$target_file"
                CREATED_FILES+=("$target_file")
                print_ok "已写入 ${target_file}"
                ;;
            2)
                local target_dir=".cursor/rules"
                local target_file="${target_dir}/cairn.mdc"
                mkdir -p "$target_dir"
                echo "$SKILL_CURSOR" > "$target_file"
                CREATED_FILES+=("$target_file")
                print_ok "已写入 ${target_file}"
                ;;
            3)
                local target_file=".clinerules"
                echo "$SKILL_GENERIC" >> "$target_file"
                CREATED_FILES+=("${target_file}（追加）")
                print_ok "已追加到 ${target_file}"
                ;;
            4)
                local target_file=".windsurfrules"
                echo "$SKILL_GENERIC" >> "$target_file"
                CREATED_FILES+=("${target_file}（追加）")
                print_ok "已追加到 ${target_file}"
                ;;
            5)
                local target_dir=".github"
                local target_file="${target_dir}/copilot-instructions.md"
                mkdir -p "$target_dir"
                echo "$SKILL_GENERIC" >> "$target_file"
                CREATED_FILES+=("${target_file}（追加）")
                print_ok "已追加到 ${target_file}"
                ;;
            *)
                print_warn "未知选项 $token，已忽略"
                ;;
        esac
    done
}

# ============================================================================
# 收尾：打印 Summary
# ============================================================================

print_summary() {
    echo ""
    print_header "初始化完成"

    echo ""
    echo -e "  ${C_BOLD}已创建的文件：${C_RESET}"
    for f in "${CREATED_FILES[@]}"; do
        echo -e "    ${C_GREEN}·${C_RESET} $f"
    done

    echo ""
    echo -e "  ${C_BOLD}目录结构：${C_RESET}"
    echo -e "    ${C_DIM}.cairn/${C_RESET}"
    echo -e "    ${C_DIM}├── output.md      ${C_RESET}Layer 1：全局约束，每次会话注入"
    echo -e "    ${C_DIM}├── domains/       ${C_RESET}Layer 2：按域读取，积累历史后生成"
    echo -e "    ${C_DIM}└── history/       ${C_RESET}Layer 3：原始决策事件，按需查询"

    echo ""
    echo -e "  ${C_BOLD}Next Steps：${C_RESET}"
    echo ""
    echo -e "  ${C_CYAN}1.${C_RESET} 完善 ${C_BOLD}.cairn/output.md${C_RESET}："
    echo -e "     · 在 ${C_BOLD}no-go${C_RESET} 中补充已知的技术禁区"
    echo -e "     · 在 ${C_BOLD}stack${C_RESET} 中填写完整的技术栈信息"
    echo ""
    echo -e "  ${C_CYAN}2.${C_RESET} 开始记录决策历史："
    echo -e "     · 复制 ${C_BOLD}.cairn/history/_TEMPLATE.md${C_RESET}"
    echo -e "     · 按格式记录重要技术决策和实验结果"
    echo -e "     · 文件命名格式：${C_BOLD}YYYY-MM_<short-slug>.md${C_RESET}"
    echo ""
    echo -e "  ${C_CYAN}3.${C_RESET} 积累 2-3 条历史记录后："
    echo -e "     · 请 AI 根据历史生成 ${C_BOLD}.cairn/domains/<domain>.md${C_RESET} 文件"
    echo -e "     · 不要在历史存在前手写 domain 文件"
    echo ""
    echo -e "  ${C_CYAN}4.${C_RESET} 格式规范参考：${C_BOLD}spec/FORMAT.md${C_RESET}"
    echo ""
}

# ============================================================================
# 主流程
# ============================================================================

main() {
    print_header "Cairn — AI 路径依赖约束系统 初始化"
    echo ""
    echo -e "  ${C_DIM}本脚本将在当前目录创建 .cairn/ 三层结构。${C_RESET}"
    echo -e "  ${C_DIM}当前目录：$(pwd)${C_RESET}"

    # 检查 .cairn/ 是否已存在
    if [ -d ".cairn" ]; then
        echo ""
        print_warn ".cairn/ 目录已存在。"
        prompt "是否覆盖并重新初始化？（输入 yes 确认，其他任意键退出）："
        read -r confirm
        if [ "$confirm" != "yes" ]; then
            echo ""
            print_info "已取消，未做任何修改。"
            exit 0
        fi
    fi

    step1_select_domains
    step2_create_output_md
    step3_init_history
    step4_init_domains
    step5_install_skills
    print_summary
}

main "$@"
