import hmac
import hashlib
import sys


from ..errors import SignatureVerificationError


class Utility(object):
    def __init__(self, client=None):
        self.client = client

    def verify_payment_signature(self, parameters):
        order_id = str(parameters['razorpay_order_id'])
        payment_id = str(parameters['razorpay_payment_id'])
        razorpay_signature = str(parameters['razorpay_signature'])
       
        msg = "{}|{}".format(order_id, payment_id)
        
        secret = str(self.client.auth[1])

        return self.verify_signature(msg, razorpay_signature, secret)

    def verify_payment_link_signature(self, parameters):
        
        if 'razorpay_payment_id' in parameters.keys() and 'payment_link_reference_id' in parameters.keys() and 'payment_link_status' in parameters.keys():
            payment_id = str(parameters['razorpay_payment_id'])
            payment_link_id = str(parameters['payment_link_id'])
            payment_link_reference_id = str(parameters['payment_link_reference_id'])
            payment_link_status = str(parameters['payment_link_status'])
            razorpay_signature = str(parameters['razorpay_signature'])
        else:
            return False
          
        msg = "{}|{}|{}|{}".format(payment_link_id, payment_link_reference_id, payment_link_status, payment_id)
        
        secret = str(parameters['secret']) if 'secret' in parameters.keys() else str(self.client.auth[1])

        return self.verify_signature(msg, razorpay_signature, secret)    
    
    def verify_subscription_payment_signature(self, parameters):
        """
        To consider the payment as successful and subscription as authorized 
        after the signature has been successfully verified
        """
        subscription_id = str(parameters['razorpay_subscription_id'])
        payment_id = str(parameters['razorpay_payment_id'])
        razorpay_signature = str(parameters['razorpay_signature'])

        msg = "{}|{}".format(payment_id, subscription_id)

        secret = str(parameters['secret']) if 'secret' in parameters.keys() else str(self.client.auth[1])

        return self.verify_signature(msg, razorpay_signature, secret)
    
    def verify_webhook_signature(self, body, signature, secret):
        return self.verify_signature(body, signature, secret)

    def verify_signature(self, body, signature, key):
        if sys.version_info[0] == 3:  # pragma: no cover
            key = bytes(key, 'utf-8')
            body = bytes(body, 'utf-8')

        dig = hmac.new(key=key,
                       msg=body,
                       digestmod=hashlib.sha256)

        generated_signature = dig.hexdigest()

        if sys.version_info[0:3] < (2, 7, 7):
            result = self.compare_string(generated_signature, signature)
        else:
            result = hmac.compare_digest(generated_signature, signature)

        if not result:
            raise SignatureVerificationError(
                'Razorpay Signature Verification Failed')
        return result

    # Taken from Django Source Code
    # Used in python version < 2.7.7
    # As hmac.compare_digest is not present in prev versions
    def compare_string(self, expected_str, actual_str):
        """
        Returns True if the two strings are equal, False otherwise
        The time taken is independent of the number of characters that match
        For the sake of simplicity, this function executes in constant time only
        when the two strings have the same length. It short-circuits when they
        have different lengths
        """
        if len(expected_str) != len(actual_str):
            return False
        result = 0
        for x, y in zip(expected_str, actual_str):
            result |= ord(x) ^ ord(y)
        return result == 0
