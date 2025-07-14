from .base import Resource
from ..constants.url import URL


class Subscription(Resource):
    def __init__(self, client=None):
        super(Subscription, self).__init__(client)
        self.base_url = URL.V1 + URL.SUBSCRIPTION_URL

    def all(self, data={}, **kwargs):
        """
        Fetch all Subscription entities

        Returns:
            Dictionary of Subscription data
        """
        return super(Subscription, self).all(data, **kwargs)

    def fetch(self, subscription_id, data={}, **kwargs):
        """
        Fetch Subscription for given Id

        Args:
            subscription_id : Id for which subscription object is retrieved

        Returns:
            Subscription dict for given subscription Id
        """
        return super(Subscription, self).fetch(subscription_id, data, **kwargs)

    def create(self, data={}, **kwargs):
        """
        Create Subscription from given dict

        Args:
            data : Dictionary using which Subscription has to be created

        Returns:
            Subscription Dict which was created
        """
        url = self.base_url
        return self.post_url(url, data, **kwargs)

    def cancel(self, subscription_id, data={}, **kwargs):
        """
        Cancel subscription given by subscription_id

        Args:
            subscription_id : Id for which subscription has to be cancelled

        Returns:
            Subscription Dict for given subscription id
        """
        url = "{}/{}/cancel".format(self.base_url, subscription_id)
        return self.post_url(url, data, **kwargs)

    def cancel_scheduled_changes(self, subscription_id, data={}, **kwargs):
        """
        Cancel a update

        Args:
            subscription_id : Id for which subscription has to be cancelled

        Returns:
            Subscription Dict for given subscription id
        """
        url = "{}/{}/cancel_scheduled_changes".format(self.base_url, subscription_id)
        return self.post_url(url, data, **kwargs)    

    def createAddon(self, subscription_id, data={}, **kwargs):
        """
        Create addon for given subscription

        Args:
            subscription_id : Id for which addon has to be created

        Return:
            Subscription dict for given subscription id
        """
        url = "{}/{}/addons".format(self.base_url, subscription_id)
        return self.post_url(url, data, **kwargs) 

    def edit(self, subscription_id, data={}, **kwargs):
        """
         Update particular subscription

        Args:
            subscription_id : Id for which subscription has to be edited         
        Returns:
            Subscription dict for given subscription id
        """
        url = '{}/{}'.format(self.base_url, subscription_id)   
        return self.patch_url(url, data, **kwargs) 

    def pending_update(self, subscription_id, **kwargs):
        """
        Fetch Subscription for given Id

        Args:
            subscription_id : Id for which subscription object is retrieved

        Returns:
            Subscription dict for given subscription Id
        """
        url = '{}/{}/retrieve_scheduled_changes'.format(self.base_url, subscription_id)   
        return self.get_url(url, {}, **kwargs)    

    def pause(self, subscription_id, data={}, **kwargs):
        """
        Cancel subscription given by subscription_id

        Args:
            subscription_id : Id for which subscription has to be paused

        Returns:
            Subscription Dict for given subscription id
        """
        url = "{}/{}/pause".format(self.base_url, subscription_id)
        return self.post_url(url, data, **kwargs)

    def resume(self, subscription_id, data={}, **kwargs):
        """
        Cancel subscription given by subscription_id

        Args:
            subscription_id : Id for which subscription has to be resume

        Returns:
            Subscription Dict for given subscription id
        """
        url = "{}/{}/resume".format(self.base_url, subscription_id)
        return self.post_url(url, data, **kwargs)

    def delete_offer(self, subscription_id, offer_id, data={}, **kwargs):
        """
        Delete offer linked to a subscription

        Args:
            subscription_id : The id of the subscription to offer need to be deleted
            offer_id : The id of the offer linked to subscription

        Returns:
            Subscription Dict for given subscription id
        """
        url = "{}/{}/{}".format(self.base_url, subscription_id, offer_id)
        return self.delete_url(url, data, **kwargs)                 
