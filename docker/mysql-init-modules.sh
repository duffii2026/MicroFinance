#!/bin/sh
set -eu

modules="central cpa credentials gateways communications companies mm2_pss_expenses mm2_inventory mm2_account_service mm2_cp_account_service mm2_company_expenses mm2_account_statements mm2_cpa_expenses mm2_gate_visa mm2_fund_recovery mm4_pss_requests mm4_fund_transfers mm4_manual_cpa mm4_auto_payment"
for module in $modules; do
  database="${MYSQL_DATABASE}_${module}"
  mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" -e \
    "CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,INDEX,ALTER ON \`${database}\`.* TO '${MYSQL_USER}'@'%';"
done
