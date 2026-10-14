import { useBlobUrl } from '../../../hooks/useBlobUrl'
import Alert from '../../ui/Alert'
import Modal from '../../ui/Modal'
import { Skeleton } from '../PortalParts'

// Shows the receipt image a student uploaded. The file is fetched with the login token: it has no public address.
export default function ProofViewer({ submission, onClose }) {
  const proof = useBlobUrl(`/portal/payments/${submission.id}/proof`)
  return (
    <Modal title="Proof of payment" subtitle={`Reference ${submission.referenceNo}`} onClose={onClose} wide>
      {proof.error && <Alert tone="error">{proof.error}</Alert>}
      {proof.loading && <Skeleton className="h-64" />}
      {proof.url && <img src={proof.url} alt={`Proof of payment, reference ${submission.referenceNo}`} className="mx-auto max-h-[70vh] max-w-full rounded border border-navy-100 object-contain" />}
    </Modal>
  )
}
