# SPEC — Acompanhamento Docente NED

## product

- P1 user:=NED; workflow:=collect>review>notify_coordinator
- P2 UI:=access_tab|delivery_tab; !executive_dashboard,!weighted_score_UI
- P3 scope_filters:=teacher_id|period|modality|Moodle_course; affect(summary|chart|list)
- P4 status_filter|pagination=>list_only; default:=access.issues + deliveries.overdue
- P5 regular:=summary+show_all; unknown!=regular
- P6 identity:=Análise Docente - Acessos e Atrasos(3).html; 4 colored_KPIs+2 column_charts/tab+white_table
- P7 chart_axis:=zero_based+integer_ticks+visible_units; unknown!=zero
- P8 access.panorama:=all_scoped_authorized_teachers; !list_pagination

## invariants

- V1 Moodle:=SELECT-only; browser!Moodle_credentials
- V2 server:=authority(status|scope|recipients)
- V3 evidence.insufficient=>NOT_VERIFIABLE; !guess
- V4 snapshot:=immutable+rule_version+reasons+evidence
- V5 quality.CRITICAL|demo|stale=>!email
- V6 structure@course_requirement; responsibility:=catalog>sole_teacher>unique_manual_owner
- V7 OTHER_TEACHER=>!charge,!manual_edit; UNCONFIRMED=>review,!charge
- V8 UA:=manual/package; video:=manual/item; quantity:=workload_h/10
- V9 UA_date:=teacher_sent; video_date:=teacher_recorded; publish_date:=informative
- V10 revision=>reason+own_deadline+actor+timestamp+preserved_history
- V11 inherited_verified=>on_time; replacement=>affected_item.reopened
- V12 substitutiva=>excluded
- V13 delay:=calendar_days(America/Sao_Paulo); pending@collection; delivered@evidence
- V14 observed_ready=>upper_bound,!exact_delivery_date,!early_claim
- V15 absent_deadline|unclear_owner=>review; !overdue_charge

## access

- truth:=mdl_user.lastaccess; !course_access,!mean,!lastlogin
- record_key:=teacher_id; names!identity
- population:=teachers_with_active_course@collection; scope only narrows population
- course_filter!change_global_access_fact
- days:=civil_days(collection,lastaccess)
- CURRENT:=0..7; ATTENTION:=8..14; CRITICAL:=15+
- SQL_zero=>NEVER; missing|future|conflict=>NOT_VERIFIABLE
- same_teacher repeated@courses=>one_access_record
- course_access retained@legacy/evidence; !notification_access_metric

## deliveries

- key:=(course_id,requirement_id); skip OTHER_TEACHER
- display:=OVERDUE|PENDING|EARLY|ON_TIME|DELIVERED_LATE|INHERITED_READY|NOT_APPLICABLE|NOT_VERIFIABLE
- PENDING + deadline_passed=>OVERDUE; accrue until delivered
- DELIVERED_LATE=>resolved_history; !open_incident
- EARLY=>exact_date<deadline; !offset_other_lateness
- COMPLIANT_filter:=EARLY|ON_TIME|INHERITED_READY
- total:=sum(exclusive_states)-NOT_APPLICABLE
- bimestres:=separate_requirements
- module_updated|completion_changed|viewed!alone_delivery_proof

## notifications

- scope:=server_recipient.courseIds; !browser_authority
- source:=same_monitoring_rules+full_scoped_snapshot; !top5_truncation
- body:=confirmed_access_issues+open_overdue_items+verified_remainder+review_needed
- resolved_late=>summary; !open_charge
- review:=To+Cc+subject+text+HTML
- UI_send:=selected_recipient_only+configured_Cc
- changed_snapshot=>409; demo!send; idempotency:=(snapshot,audience,recipient)
- no_mapped_courses|unverified|stale=>blocked
- worker_default_audience:=coordinators

## security

- prod:=institutional_OIDC/proxy+server_NED_mapping
- session:=HttpOnly+Secure+SameSite=Strict
- mutations:=exact_origin+CSRF+RBAC
- coordinator_backend_scope retained_for_report_isolation
- SQL:=READ_COMMITTED+verified_TLS+SELECT_only; !NOLOCK

## acceptance

- global_access 2d + course_access 16d=>CURRENT(2d)
- teacher in two disciplines=>one_global_access
- filter_teacher=>both_tabs+manual_scope
- pending_days 7>10; delivered@10=>freeze10+resolved
- unknown_owner|missing_date!charge
- same_name,different_ids=>separate
- contradictory_global_facts=>block
- empty_query!all_regular
- manual_revision preserves_prior; publication!delivery_status
- selected_coordinator!other_courses; configured_Cc included
- snapshot_changed|demo|stale=>email_blocked

## validation

- npm run check; npm --prefix backend run validate:data -- --fresh
- UI_SSR:=content+values; !browser_interaction_proof
- Moodle_real|SMTP|Docker_runtime|browser_visual=>institutional_validation_pending
- live_rules:=PILOT until homologation; deadline_catalog initially empty
