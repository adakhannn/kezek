-- The rating recalculation functions are for the server only (docs/ENGINEERING_FINDINGS.md ENG-122).
--
-- Nine SECURITY INVOKER functions of the rating model kept the EXECUTE that the prod baseline gave
-- PUBLIC, anon and authenticated. The application calls them only with the service role (the
-- ratings cron, the manual recalculation and the rating settings of the admin panel), and
-- recalculate_ratings_for_date, the only SQL caller outside this group, is SECURITY DEFINER.
--
-- Through the REST API anyone could still start them. RLS refused their writes, but
-- recalculate_ratings_for_date_range walks every staff member, branch and business for each day of
-- any requested range and catches every error, so one anonymous request over a range of centuries
-- kept a database connection busy until the statement timeout; initialize_all_ratings and
-- update_all_aggregated_ratings walk all rows the same way.
--
-- Only service_role keeps EXECUTE. Re-running changes nothing.

revoke execute on function
    public.calculate_biz_day_metrics(uuid, date),
    public.calculate_biz_rating(uuid),
    public.calculate_branch_day_metrics(uuid, date),
    public.calculate_branch_rating(uuid),
    public.calculate_staff_day_metrics(uuid, date),
    public.calculate_staff_rating(uuid),
    public.initialize_all_ratings(integer),
    public.recalculate_ratings_for_date_range(date, date),
    public.update_all_aggregated_ratings()
from public, anon, authenticated;

grant execute on function
    public.calculate_biz_day_metrics(uuid, date),
    public.calculate_biz_rating(uuid),
    public.calculate_branch_day_metrics(uuid, date),
    public.calculate_branch_rating(uuid),
    public.calculate_staff_day_metrics(uuid, date),
    public.calculate_staff_rating(uuid),
    public.initialize_all_ratings(integer),
    public.recalculate_ratings_for_date_range(date, date),
    public.update_all_aggregated_ratings()
to service_role;
