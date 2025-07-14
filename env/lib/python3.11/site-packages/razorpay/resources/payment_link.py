from .base import Resource
from ..constants.url import URL
import warnings


class PaymentLink(Resource):
    def __init__(self, client=None):
        super(PaymentLink, self).__init__(client)
        self.base_url = URL.V1 + URL.PAYMENT_LINK_URL

    def fetch_all(self, data={}, **kwargs):  # pragma: no cover
        warnings.warn("Will be Deprecated in next release", DeprecationWarning)
        return self.all(data, **kwargs)

    def all(self, data={}, **kwargs):
        """
        Fetch all Payment link entities

        Returns:
            Dictionary of Payment link data
        """
        return super(PaymentLink, self).all(data, **kwargs)

    def fetch(self, payment_link_id, data={}, **kwargs):
        """
        Fetch Payment link for given Id

        Args:
            payment_link_id : Id for which Payment link object has to be retrieved

        Returns:
            Payment link dict for given payment_link_id Id
        """
        return super(PaymentLink, self).fetch(payment_link_id, data, **kwargs)

    def create(self, data={}, **kwargs):
        """
        Create Payment link from given dict

        Args:
            data : Dictionary having keys using which Payment link have to be created

        Returns:
            Payment link Dict which was created
        """
        url = self.base_url
        return self.post_url(url, data, **kwargs)

    def cancel(self, payment_link_id, **kwargs):
        """
        Cancel an unpaid Payment link with given ID via API
        It can only be called on an Payment link that is not in the paid state.

        Args:
            payment_link_id : Id for cancel the Payment link
        Returns:
            The response for the API will be the Payment link entity, similar to create/update API response, with status attribute's value as cancelled
        """
        url = "{}/{}/cancel".format(self.base_url, payment_link_id)
        return self.post_url(url, {}, **kwargs)
   
    def edit(self, payment_link_id, data={}, **kwargs):
        """
        Edit the Payment link
        Args:
            data : Dictionary having keys using which order have to be edited
                reference_id : Adds a unique reference number to an existing link.

                expire_by : Timestamp, in Unix format, when the payment links should expire.

                notes : key value pair as notes
            
            Returns:
            Payment Link Dict which was edited
        """
        url = '{}/{}'.format(self.base_url, payment_link_id)
        return self.patch_url(url, data, **kwargs)

    def notifyBy(self, payment_link_id, medium, **kwargs):
        """
        Send notification

        Args:
            payment_link_id : Unique identifier of the Payment Link that should be resent.
            
            medium : sms/email
        """
        url = "{}/{}/notify_by/{}".format(self.base_url, payment_link_id, medium)
        return self.post_url(url, {}, **kwargs) 
