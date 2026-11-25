import BusinessPageState from './BusinessPageState';

/** An unknown or unpublished business answers HTTP 404 with the same localized page (not a soft 404). */
export default function BusinessNotFound() {
    return <BusinessPageState kind="not-found" />;
}
