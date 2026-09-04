# SPEC — Painel Docente

## invariants

- V1 Moodle:=SELECT-only; browser!query Moodle
- V2 browser!authority(status|scope|recipients); server:=authority
- V3 row_key:=(snapshot_id,course_id,teacher_id,requirement_id)
- V4 result=>{rule_version,reason,evidence,calculated_at}
- V5 quality.CRITICAL=>publish=false,email=false
- V6 INHERITED_READY=>structure=met; teacher_delivery=exempt; access=assessed
- V7 evidence.insufficient=>NOT_VERIFIABLE; !guess
- V8 structure@course; access@(course,teacher); co-teaching!duplicate_blame
- V9 report:=immutable_snapshot
- V10 email.default:=PREVIEW_ONLY; recipients:=server_config
- V11 moodle.log!define delivery_time; snapshot_ready:=timing proof

## roles

- ned_admin: all+collect+preview+gated_send
- coordinator: scoped_courses+detail+preview
- executive: all+summary
- auditor: all+read_only

## auth

- prod:=institutional OIDC/proxy + server mapping
- demo:=dev only
- session:=HttpOnly+Secure+SameSite=Strict
- mutation:=exact_origin+CSRF+RBAC

## status

- structure:=PENDING|DELIVERED_LATE|DELIVERED_ON_TIME|INHERITED_READY|NOT_VERIFIABLE
- access:=CURRENT(0..3d)|ATTENTION(4..6d)|CRITICAL(>=7d)|NEVER|OUTSIDE_WINDOW
- provenance:=INHERITED_VERIFIED|RESTORED_NOT_EXEMPT|CREATED_FOR_PERIOD

## evidence

- truth.structure:=current module state + approved requirement/deadline catalog
- log.course_module_updated:=interaction support; !delivery_time
- log.course_module_completion_updated:=access/interation only; !delivery
- log.*course_module_viewed:=interaction only; !delivery
- truth.access:=user_lastaccess + viewed|updated|completion_changed by teacher
- historical timing unknown=>NOT_VERIFIABLE
- ready_snapshot<=deadline=>DELIVERED_ON_TIME
- pending_snapshot>=deadline + later_ready=>DELIVERED_LATE

## quality gates

- rules_not_approved | deadline_missing | modality_unmapped | workload_unmapped | duplicate_key | source_error => BLOCKED
- blocked=>dashboard visible + warning; email disabled

## acceptance

- completion_changed + incomplete Tarefa=>PENDING
- viewed + incomplete Tarefa=>PENDING
- updated_log + ready_current + no_snapshot=>NOT_VERIFIABLE
- inherited complete before teacher assignment=>INHERITED_READY + independent access
- coordinator A!receive coordinator B courses
- access summary dedupe(course,teacher)
- demo!send external email
- unsafe origin|missing CSRF=>403

## pilot limits

- live email remains gated until NED+TI validation
- exact institutional OIDC metadata required
- live Moodle requires read-only credential + verified TLS
- business catalog remains PILOT until signed checklist
