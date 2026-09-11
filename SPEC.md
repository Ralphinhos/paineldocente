# SPEC — Painel Docente

## invariants

- V1 Moodle:=SELECT-only; browser!query Moodle
- V2 browser!authority(status|scope|recipients); server:=authority
- V3 row_key:=(snapshot_id,course_id,teacher_id,requirement_key)
- V4 result=>{rule_version,reason,evidence,calculated_at}
- V5 quality.CRITICAL=>publish=false,email=false
- V6 INHERITED_READY=>structure=met; teacher_delivery=exempt; access=assessed
- V7 evidence.insufficient=>NOT_VERIFIABLE; !guess
- V8 structure@course; access@(course,teacher); co-teaching!duplicate_blame
- V9 report:=immutable_snapshot
- V10 email.default:=PREVIEW_ONLY; recipients:=server_config
- V11 moodle.log!define delivery_time; snapshot_ready:=timing proof
- V12 UA:=manual/package/course; video:=manual/item; video.qty:=workload_h/10
- V13 published_date:=operational_only; !teacher_KPI
- V14 NOT_APPLICABLE=>justification+actor+timestamp; excluded_KPI
- V15 material_revision=>append_only+reason+own_deadline+actor+timestamp; current:=max(revision)
- V16 unchanged_inherited=>exempt; revision_requested=>affected_item.reopened
- V17 substitutiva=>excluded(requirements|KPI|ranking|report)
- V18 delay:=calendar_days(America/Sao_Paulo); pending@collection; delivered@evidence
- V19 observed_ready_date=>upper_bound; !exact_delay; unknown=>no_composite_score
- V20 delivery_owner:=catalog>sole_teacher>unique_manual_owner; ambiguous=>unconfirmed
- V21 course_item counted_once; other_teacher=>!delivery_score,!manual_edit

## ranking

- snapshot.policy:=versioned; old_snapshot!recomputed
- base:=assigned+required+deadline_day_passed; exclude(NA|inherited|substitutiva)
- punctuality:=mean_course(on_time/due)*50
- delay:=mean_course_with_late(mean_late_item_days); bands(0:20,>0..3:15,>3..7:10,>7..14:5,>14:0)
- access:=mean_active_course(0..7:30,8..14:15,15+|never:0)
- score:=punctuality+delay+access; require(all_components+complete_evidence)
- access_only:=separate_scale(0..100); !composite_competition
- priority:=score_ASC; regularity:=score_DESC; current_incidents remain_visible
- scope_filters=>KPI+ranking+list; status_filter=>list_only; pagination!ranking_base
- summary.avg_delay:=completed_exact_only; ranking.delay includes_overdue_pending

## workspace

- NED:=tracking|manual_materials|quality_reports; dirty_manual=>save_or_discard_before_switch
- executive:=four_metrics+ranking+current_incidents+weekly_trend
- details:=on_demand; dialog:=native_modal+keyboard; report:=preview+HTML_download
- report.scope:=all_rows; executive.incidents:=top5+remaining_count
- report.batch:=pinned_snapshot; preview_changed=>409; demo!send
- trend:=latest_per_week+same_rules+same_source+scope; points<2=>empty_state

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

- structure:=PENDING|DELIVERED_LATE|DELIVERED_ON_TIME|INHERITED_READY|NOT_APPLICABLE|NOT_VERIFIABLE
- access:=CURRENT(0..7d)|ATTENTION(8..14d)|CRITICAL(>=15d)|NEVER|OUTSIDE_WINDOW
- provenance:=INHERITED_VERIFIED|RESTORED_NOT_EXEMPT|CREATED_FOR_PERIOD

## evidence

- truth.structure:=current module state + approved requirement/deadline catalog
- log.course_module_updated:=interaction support; !delivery_time
- log.course_module_completion_updated:=access/interaction only; !delivery
- log.*course_module_viewed:=interaction only; !delivery
- truth.access:=user_lastaccess + viewed|updated|completion_changed by teacher
- historical timing unknown=>NOT_VERIFIABLE
- ready_snapshot<=deadline=>DELIVERED_ON_TIME
- pending_snapshot>=deadline + later_ready=>DELIVERED_LATE
- manual UA|video evidence_date vs active_revision_deadline=>on_time|late
- revision>1 without reason|deadline=>NOT_VERIFIABLE
- manual pending + deadline passed=>PENDING.overdue

## quality gates

- rules_not_approved | deadline_missing | modality_unmapped | workload_unmapped | duplicate_key | source_error => BLOCKED
- blocked=>dashboard visible + warning; email disabled

## acceptance

- completion_changed + incomplete Tarefa=>PENDING
- viewed + incomplete Tarefa=>PENDING
- UA sent date|video recorded date=>manual evidence; Moodle label edit!delivery
- UA rows/course/teacher:=1; video rows/course/teacher:=workload_h/10
- date correction=>same revision; material replacement=>new revision+old preserved
- inherited + replacement=>new revision PENDING; untouched requirements stay INHERITED_READY
- published_date change!status
- NOT_APPLICABLE without reason=>reject
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
