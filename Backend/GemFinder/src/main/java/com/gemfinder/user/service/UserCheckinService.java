package com.gemfinder.user.service;

import com.gemfinder.user.dto.CheckinRequest;
import com.gemfinder.user.dto.UserCheckinDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface UserCheckinService {

    /** Returns all checkins by a user (paginated). */
    Page<UserCheckinDTO> getByUser(Long userId, Pageable pageable);

    /** Returns all checkins for an attraction (paginated). */
    Page<UserCheckinDTO> getByAttraction(Long attractionId, Pageable pageable);

    /** Records a new checkin; busynessAtVisit is optional. */
    UserCheckinDTO checkin(Long userId, Long attractionId, CheckinRequest request);
}
